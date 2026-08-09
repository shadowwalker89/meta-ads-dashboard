import type { AdAccount } from "@repo/shared";
import type { RawCampaignMetrics } from "./raw-campaign-metrics.js";

/**
 * Anything that can collect data for one AdAccount implements this.
 * Takes the full AdAccount (not just its internal id) because a real
 * Collector needs `metaAdAccountId` to build the Meta Ads Manager URL
 * — the internal UUID means nothing to Meta. A future MetaApiCollector
 * implements the exact same interface, so CollectorOrchestrator never
 * needs to change.
 */
export interface CollectorProvider {
  collect(adAccount: AdAccount): Promise<RawCampaignMetrics[]>;
}
