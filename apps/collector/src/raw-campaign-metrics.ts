/**
 * Exactly what a Collector implementation hands to the Orchestrator —
 * raw UI/export strings, not yet parsed into numbers. Storage-agnostic
 * and source-agnostic: a future MetaApiCollector would map the API
 * JSON response into this exact same shape.
 */
export interface RawCampaignMetrics {
  scrapedLabel: string;
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