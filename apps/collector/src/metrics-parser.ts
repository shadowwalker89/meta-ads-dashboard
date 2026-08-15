import { parseLocalizedNumber } from "./number-normalizer.js";
import type { RawCampaignMetrics } from "./raw-campaign-metrics.js";

export interface ParsedCampaignMetrics {
  scrapedLabel: string;
  impressions: number;
  clicks: number;
  linkClicks: number;
  spend: number;
  ctr: number;
  cpc: number;
  cpm: number;
  reach: number;
  frequency: number;
  clicksAll: number;
  uniqueClicks: number;
  uniqueCtr: number;
  landingPageViews: number;
  outboundClicks: number;
  outboundCtr: number;
  leads: number;
  messagesStarted: number;
  messagesContacts: number;
  results: number;
  costPerResult: number;
  postReactions: number;
  postComments: number;
  rawPayload: Record<string, unknown>;
}

type MetricField = Exclude<keyof ParsedCampaignMetrics, "rawPayload">;

/**
 * Meta Ads Manager CSV headers vary between accounts, locales and
 * "Customize columns" setups, so each canonical field accepts several
 * real-world variants. Headers are matched case/space/punctuation-
 * insensitively (see normalizeHeader). A single column can feed more
 * than one canonical field — e.g. "Link clicks" feeds both `clicks`
 * and `linkClicks` (product decision: `clicks` reads the link-click
 * value, while "Clicks (all)" is captured separately as `clicksAll`).
 */
const FIELD_ALIASES: Record<MetricField, string[]> = {
  scrapedLabel: ["Campaign name"],
  impressions: ["Impressions"],
  clicks: ["Link clicks"],
  linkClicks: ["Link clicks"],
  clicksAll: ["Clicks (all)", "Clicks all", "Clicks"],
  spend: ["Amount spent", "Amount Spent (USD)", "Spend"],
  ctr: ["CTR (all)", "CTR"],
  cpc: ["CPC (cost per link click)", "CPC (all) (USD)", "CPC"],
  cpm: ["CPM (cost per 1,000 impressions) (USD)", "CPM"],
  reach: ["Reach"],
  frequency: ["Frequency"],
  uniqueClicks: ["Unique clicks"],
  uniqueCtr: ["Unique CTR", "Unique CTR (all)"],
  landingPageViews: ["Landing page views"],
  outboundClicks: ["Outbound clicks"],
  outboundCtr: ["Outbound CTR"],
  leads: ["Leads", "Website Leads"],
  messagesStarted: ["Messages started", "Messaging conversations started"],
  messagesContacts: ["Messages contacts", "Messaging conversations"],
  results: ["Results"],
  costPerResult: ["Cost per result", "Cost Per Result"],
  postReactions: ["Post reactions"],
  postComments: ["Post comments"],
};

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const HEADER_TO_FIELDS = new Map<string, MetricField[]>();
for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [
  MetricField,
  string[]
][]) {
  for (const alias of aliases) {
    const key = normalizeHeader(alias);
    const existing = HEADER_TO_FIELDS.get(key);
    if (existing) existing.push(field);
    else HEADER_TO_FIELDS.set(key, [field]);
  }
}

/**
 * Converts scraped/raw string metrics into the typed numbers
 * InsightSnapshot needs. The Domain Model defines these fields as
 * plain `number` (not nullable) — so an empty/unavailable raw value
 * ("-", "N/A", "") normalizes to 0 here, deliberately, rather than
 * changing the Domain Model to allow null. `parseLocalizedNumber`
 * itself still returns `null` for those inputs (see its own unit
 * tests) — this is the one place that decides what "no value" means
 * for a snapshot.
 */
export class MetricsParser {
  parse(raw: RawCampaignMetrics): ParsedCampaignMetrics {
    const toNumber = (value: string) => parseLocalizedNumber(value) ?? 0;

    return {
      scrapedLabel: raw.scrapedLabel,
      impressions: toNumber(raw.impressions),
      clicks: toNumber(raw.clicks),
      linkClicks: toNumber(raw.linkClicks),
      spend: toNumber(raw.spend),
      ctr: toNumber(raw.ctr),
      cpc: toNumber(raw.cpc),
      cpm: toNumber(raw.cpm),
      reach: toNumber(raw.reach),
      frequency: toNumber(raw.frequency),
      clicksAll: toNumber(raw.clicksAll),
      uniqueClicks: toNumber(raw.uniqueClicks),
      uniqueCtr: toNumber(raw.uniqueCtr),
      landingPageViews: toNumber(raw.landingPageViews),
      outboundClicks: toNumber(raw.outboundClicks),
      outboundCtr: toNumber(raw.outboundCtr),
      leads: toNumber(raw.leads),
      messagesStarted: toNumber(raw.messagesStarted),
      messagesContacts: toNumber(raw.messagesContacts),
      results: toNumber(raw.results),
      costPerResult: toNumber(raw.costPerResult),
      postReactions: toNumber(raw.postReactions),
      postComments: toNumber(raw.postComments),
      rawPayload: { ...raw },
    };
  }

  /**
   * Parses a single CSV data row keyed by its raw Meta headers (e.g.
   * { "Amount spent": "500", "Clicks (all)": "3000" }). Column names
   * are matched through the FIELD_ALIASES table, so headers that vary
   * between exports resolve to the same canonical metric. Columns
   * without a matching alias are ignored; missing metrics are 0.
   */
  parseCsvRow(row: Record<string, string>): ParsedCampaignMetrics {
    const values = new Map<MetricField, string>();

    for (const [header, value] of Object.entries(row)) {
      const fields = HEADER_TO_FIELDS.get(normalizeHeader(header));
      if (!fields) continue;
      for (const field of fields) {
        values.set(field, value);
      }
    }

    const get = (field: MetricField) => values.get(field) ?? "";

    return this.parse({
      scrapedLabel: get("scrapedLabel"),
      impressions: get("impressions"),
      clicks: get("clicks"),
      linkClicks: get("linkClicks"),
      spend: get("spend"),
      ctr: get("ctr"),
      cpc: get("cpc"),
      cpm: get("cpm"),
      reach: get("reach"),
      frequency: get("frequency"),
      clicksAll: get("clicksAll"),
      uniqueClicks: get("uniqueClicks"),
      uniqueCtr: get("uniqueCtr"),
      landingPageViews: get("landingPageViews"),
      outboundClicks: get("outboundClicks"),
      outboundCtr: get("outboundCtr"),
      leads: get("leads"),
      messagesStarted: get("messagesStarted"),
      messagesContacts: get("messagesContacts"),
      results: get("results"),
      costPerResult: get("costPerResult"),
      postReactions: get("postReactions"),
      postComments: get("postComments"),
    });
  }
}