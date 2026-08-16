import type {
  AdAccount,
  AdAccountRepository,
  Campaign,
  CampaignRepository,
  ClientRepository,
  CollectorJobRepository,
  InsightSnapshotRepository,
} from "@repo/shared";
import type { CollectorProvider } from "./collector-provider.js";
import type { MetricsParser } from "./metrics-parser.js";

/**
 * The business rule a write path must satisfy before creating a
 * resource. Implemented by SqlitePackageEnforcement (which reads limits
 * from the Package entity, never from package code strings). Kept as an
 * interface here so the orchestrator stays decoupled from storage.
 */
export interface PackageLimitEnforcer {
  assertCanCreateCampaign(clientId: string): Promise<void>;
}

export interface CollectorOrchestratorDeps {
  clientRepository: ClientRepository;
  adAccountRepository: AdAccountRepository;
  campaignRepository: CampaignRepository;
  collectorJobRepository: CollectorJobRepository;
  insightSnapshotRepository: InsightSnapshotRepository;
  collectorProvider: CollectorProvider;
  metricsParser: MetricsParser;
  /** Enforces Package.maxCampaigns before a NEW campaign is created. */
  packageEnforcement: PackageLimitEnforcer;
}

/**
 * Coordinates one full collection pass. Contains NO scraping logic
 * and NO SQL — it only calls CollectorProvider.collect(), and for
 * each raw row: finds-or-creates the matching Campaign, converts the
 * raw metrics through MetricsParser, and saves the result.
 */
export class CollectorOrchestrator {
  constructor(private readonly deps: CollectorOrchestratorDeps) {}

  async runForAllClients(): Promise<void> {
    let cursor: string | undefined = undefined;

    do {
      const page = await this.deps.clientRepository.list({ limit: 50, cursor });

      for (const client of page.items) {
        const adAccounts = await this.deps.adAccountRepository.findByClient(client.id);

        for (const adAccount of adAccounts) {
          await this.collectForAdAccount(adAccount);
        }
      }

      cursor = page.nextCursor ?? undefined;
    } while (cursor);
  }

  async collectForAdAccount(adAccount: AdAccount): Promise<void> {
    const job = await this.deps.collectorJobRepository.start(adAccount.id, "playwright");
    console.log(`[Collector] job ${job.id} started for adAccountId=${adAccount.id}`);

    try {
      const rawRows = await this.deps.collectorProvider.collect(adAccount);

      for (const raw of rawRows) {
        const campaign = await this.discoverCampaign(adAccount, raw.scrapedLabel);

        const parsed = this.deps.metricsParser.parse(raw);
        await this.deps.insightSnapshotRepository.append({
          campaignId: campaign.id,
          capturedAt: new Date(),
          ...parsed,
        });
        console.log(`[Collector] snapshot saved: campaignId=${campaign.id}`);
      }

      await this.deps.collectorJobRepository.complete(job.id, "success");
      console.log(`[Collector] job ${job.id} completed successfully`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.deps.collectorJobRepository.complete(job.id, "failed", message);
      console.error(`[Collector] job ${job.id} failed: ${message}`);
    }
  }

  /**
   * scrapedLabel is treated as the campaign's current identity (real
   * Meta campaign IDs aren't available from the CSV export). Existing
   * Campaigns are matched and reused; a new one is only created when
   * no match exists — never with a made-up id, so InsightSnapshot's
   * foreign key always points at a real row.
   *
   * Package enforcement runs only on the CREATE branch: discovering an
   * existing campaign consumes no new slot, so an at-limit client can
   * still collect the campaigns it already has. A new campaign beyond
   * the limit throws, which surfaces as CollectorJob.status = "failed".
   */
  private async discoverCampaign(
    adAccount: AdAccount,
    scrapedLabel: string
  ): Promise<Campaign> {
    const existing = await this.deps.campaignRepository.findByAdAccountAndLabel(
      adAccount.id,
      scrapedLabel
    );

    if (existing) {
      console.log(
        `[Collector] campaign discovered: ${scrapedLabel} (existing, id=${existing.id})`
      );
      return existing;
    }

    await this.deps.packageEnforcement.assertCanCreateCampaign(adAccount.clientId);

    const created = await this.deps.campaignRepository.create({
      adAccountId: adAccount.id,
      name: scrapedLabel,
      objective: "unknown",
      status: "unknown",
      scrapedLabel,
      metaCampaignId: null,
    });
    console.log(`[Collector] campaign discovered: ${scrapedLabel} (new, id=${created.id})`);
    return created;
  }
}
