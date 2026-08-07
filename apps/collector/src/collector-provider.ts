import type { RawCampaignMetrics } from "./raw-campaign-metrics.js";

/**
 * Anything that can collect data for one AdAccount implements this.
 * Today the only implementation is PlaywrightCollector; a future
 * MetaApiCollector will implement the exact same interface (same
 * return shape), so CollectorOrchestrator never needs to change.
 */
export interface CollectorProvider {
  collect(adAccountId: string): Promise<RawCampaignMetrics[]>;
}
