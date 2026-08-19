/**
 * Exactly what a Collector implementation hands to the Orchestrator —
 * raw UI/export strings, not yet parsed into numbers. Storage-agnostic
 * and source-agnostic: a future MetaApiCollector would map the API
 * JSON response into this exact same shape.
 */
export interface RawCampaignMetrics {
  scrapedLabel: string;
  /**
   * Meta's "Campaign ID" column, when the export provides it (present in
   * the test fixture). Read only at the parser boundary — NOT persisted
   * to Campaign.metaCampaignId yet, because the 2026-08-08 confirmed
   * export did not include the column. Null when the column is absent.
   */
  metaCampaignId: string | null;
  /**
   * "Reporting starts" / "Reporting ends" CSV columns. Header names are
   * CONFIRMED from a real export (Phase 2B audit) but the exact date
   * serialization is UNVERIFIED — so these are carried as opaque raw
   * strings, never parsed or inferred. Null when absent or empty.
   */
  reportingFrom: string | null;
  reportingTo: string | null;
  impressions: string;
  clicks: string;
  linkClicks: string;
  spend: string;
  ctr: string;
  cpc: string;
  cpm: string;
  reach: string;
  frequency: string;
  clicksAll: string;
  uniqueClicks: string;
  uniqueCtr: string;
  landingPageViews: string;
  outboundClicks: string;
  outboundCtr: string;
  leads: string;
  messagesStarted: string;
  messagesContacts: string;
  results: string;
  costPerResult: string;
  postReactions: string;
  postComments: string;
}