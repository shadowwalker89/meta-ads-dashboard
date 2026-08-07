/**
 * Exactly what a Collector implementation hands to the Orchestrator —
 * raw UI strings, not yet parsed into numbers. Storage-agnostic and
 * source-agnostic: a future MetaApiCollector would map the API JSON
 * response into this exact same shape.
 */
export interface RawCampaignMetrics {
  scrapedLabel: string;
  impressions: string;
  clicks: string;
  spend: string;
  ctr: string;
  cpc: string;
  cpm: string;
  reach: string;
}
