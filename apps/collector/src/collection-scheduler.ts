import type {
  AdAccount,
  AdAccountRepository,
  ClientRepository,
  CollectorJobRepository,
  PackageRepository,
} from "@repo/shared";
import { isCollectionDue, normalizeCollectionFrequency } from "@repo/shared";
import type { CollectorOrchestrator } from "./collector-orchestrator.js";

/**
 * Collection Scheduler.
 *
 * The production-oriented scheduling foundation. It decides WHICH ad
 * accounts are due for collection and invokes the orchestrator only for
 * those — it never contains Meta collection logic itself and never
 * replaces CollectorOrchestrator. The flow it drives:
 *
 *   external trigger (cron / Task Scheduler / GH Actions / Docker)
 *              ↓
 *   CollectionScheduler.findDueAdAccounts() / runDueCollections()
 *              ↓
 *   CollectorOrchestrator.collectForAdAccount()   (due accounts only)
 *              ↓
 *   CollectorJob + InsightSnapshot (via repositories)
 *
 * The scheduler is a plain callable service — NOT a background process
 * — so any external mechanism can invoke it. No cron is built here.
 *
 * Per-ad-account decision: CollectorJob history is recorded per ad
 * account, so due-checks are per ad account. Each account's client
 * resolves to its Package (collectionFrequency), and the latest job's
 * startedAt is the last-run marker.
 */

export interface CollectionSchedulerDeps {
  clientRepository: ClientRepository;
  adAccountRepository: AdAccountRepository;
  packageRepository: PackageRepository;
  collectorJobRepository: CollectorJobRepository;
  /** The orchestrator performs the actual collection (due accounts only). */
  orchestrator: CollectorOrchestrator;
}

/** One ad account judged due, with the settings used to decide. */
export interface DueAdAccount {
  adAccount: AdAccount;
  /** Effective runs/day used (normalized; 1 for missing/invalid). */
  collectionFrequency: number;
  /** Time of the account's latest CollectorJob, or null if never run. */
  lastRunAt: Date | null;
}

export interface SchedulerRunResult {
  /** Total ad accounts evaluated across all clients. */
  evaluated: number;
  /** Ad accounts collection was actually invoked for. */
  collected: number;
  /** Ad accounts evaluated but skipped (not due). */
  skipped: number;
}

export class CollectionScheduler {
  constructor(private readonly deps: CollectionSchedulerDeps) {}

  /**
   * All ad accounts that are due right now. Pure "what is due" —
   * does not start any collection, so it is safe for reports/tests.
   */
  async findDueAdAccounts(now: Date = new Date()): Promise<DueAdAccount[]> {
    const { due } = await this.evaluate(now);
    return due;
  }

  /**
   * The entry point an external scheduler calls: evaluates every ad
   * account and invokes collection for exactly the due ones.
   */
  async runDueCollections(now: Date = new Date()): Promise<SchedulerRunResult> {
    const { due, evaluated } = await this.evaluate(now);

    for (const entry of due) {
      console.log(
        `[Scheduler] collecting adAccountId=${entry.adAccount.id} ` +
          `(frequency=${entry.collectionFrequency}/day, lastRunAt=${entry.lastRunAt?.toISOString() ?? "never"})`
      );
      await this.deps.orchestrator.collectForAdAccount(entry.adAccount);
    }

    return { evaluated, collected: due.length, skipped: evaluated - due.length };
  }

  /**
   * Evaluates every ad account of every client against the shared
   * due-check domain logic (isCollectionDue). The latest CollectorJob's
   * startedAt is the last-run marker REGARDLESS of job status:
   *
   *   - a running job that started within the interval is "not due",
   *     so two overlapping scheduler invocations never start a second
   *     collection for the same account (in-flight guard);
   *   - a stale "running" job (older than the interval, e.g. after a
   *     crash that never completed) is due again, so a permanently
   *     stuck status can never block the account forever.
   *
   * No migration/locking is needed: collector_jobs already carries the
   * data this relies on. The only residual window is two invocations
   * reading at the exact same millisecond before either starts a job —
   * acceptable for the first foundation; hardening it would be a unique
   * partial index on running jobs (future work, deliberately not
   * over-engineered here).
   */
  private async evaluate(now: Date): Promise<{ due: DueAdAccount[]; evaluated: number }> {
    const due: DueAdAccount[] = [];
    let evaluated = 0;
    let cursor: string | undefined;

    do {
      const page = await this.deps.clientRepository.list({ limit: 50, cursor });

      for (const client of page.items) {
        const collectionFrequency = await this.resolveCollectionFrequency(
          client.packageId
        );
        const adAccounts = await this.deps.adAccountRepository.findByClient(client.id);

        for (const adAccount of adAccounts) {
          evaluated += 1;

          const lastJob =
            await this.deps.collectorJobRepository.findLatestForAdAccount(adAccount.id);
          const lastRunAt = lastJob?.startedAt ?? null;

          if (
            isCollectionDue({
              collectionFrequency,
              lastRunAt,
              now,
            })
          ) {
            due.push({ adAccount, collectionFrequency, lastRunAt });
          }
        }
      }

      cursor = page.nextCursor ?? undefined;
    } while (cursor);

    return { due, evaluated };
  }

  /**
   * Package settings are the single source of truth for frequency. A
   * missing package or a non-positive/invalid value falls back to the
   * conservative default (1 run/day) via the existing shared helper.
   */
  private async resolveCollectionFrequency(packageId: string): Promise<number> {
    const pkg = await this.deps.packageRepository.findById(packageId);
    return normalizeCollectionFrequency(pkg?.collectionFrequency);
  }
}