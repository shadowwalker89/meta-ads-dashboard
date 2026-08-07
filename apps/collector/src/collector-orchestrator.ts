import type {
  AdAccountRepository,
  CampaignRepository,
  ClientRepository,
  CollectorJobRepository,
  InsightSnapshotRepository,
} from "@repo/shared";
import type { CollectorProvider } from "./collector-provider.js";
import type { MetricsParser } from "./metrics-parser.js";

export interface CollectorOrchestratorDeps {
  clientRepository: ClientRepository;
  adAccountRepository: AdAccountRepository;
  campaignRepository: CampaignRepository;
  collectorJobRepository: CollectorJobRepository;
  insightSnapshotRepository: InsightSnapshotRepository;
  collectorProvider: CollectorProvider;
  metricsParser: MetricsParser;
}

/**
 * Coordinates one full collection pass. Contains NO scraping logic —
 * it only calls CollectorProvider.collect() and trusts it to do the
 * actual work. Everything here is built from existing Repository
 * interfaces; none of them were modified for this sprint.
 */
export class CollectorOrchestrator {
  constructor(private readonly deps: CollectorOrchestratorDeps) {}

  /**
   * Pages through every Client (via ClientRepository.list — the
   * existing cursor-based contract, unchanged), and for each one
   * collects every AdAccount belonging to it.
   */
  async runForAllClients(): Promise<void> {
    let cursor: string | undefined = undefined;

    do {
      const page = await this.deps.clientRepository.list({ limit: 50, cursor });

      for (const client of page.items) {
        const adAccounts = await this.deps.adAccountRepository.findByClient(client.id);

        for (const adAccount of adAccounts) {
          await this.collectForAdAccount(adAccount.id);
        }
      }

      cursor = page.nextCursor ?? undefined;
    } while (cursor);
  }

  async collectForAdAccount(adAccountId: string): Promise<void> {
    const job = await this.deps.collectorJobRepository.start(adAccountId, "playwright");
    console.log(
      `[CollectorOrchestrator] job ${job.id} started for adAccountId=${adAccountId}`
    );

    try {
      await this.deps.collectorProvider.collect(adAccountId);

      // Only save snapshots for Campaigns that already exist for this
      // AdAccount. Campaign *discovery* isn't implemented until a later
      // sprint, so on a fresh database this loop simply does nothing —
      // which is correct, not a bug: InsightSnapshot has a foreign key
      // to Campaign, so writing a snapshot against a made-up campaign
      // id would fail (or worse, silently corrupt data).
      const campaigns = await this.deps.campaignRepository.findByAdAccount(adAccountId);

      if (campaigns.length === 0) {
        console.log(
          `[CollectorOrchestrator] no campaigns yet for adAccountId=${adAccountId} — nothing to save`
        );
      }

      for (const campaign of campaigns) {
        // Mocked numbers — proves the parse → save path works
        // end-to-end. Real scraped/API values replace this input
        // later without changing this method's structure.
        const snapshot = this.deps.metricsParser.parse({ campaignId: campaign.id });
        await this.deps.insightSnapshotRepository.append(snapshot);
      }

      await this.deps.collectorJobRepository.complete(job.id, "success");
      console.log(`[CollectorOrchestrator] job ${job.id} completed successfully`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.deps.collectorJobRepository.complete(job.id, "failed", message);
      console.error(`[CollectorOrchestrator] job ${job.id} failed: ${message}`);
    }
  }
}
