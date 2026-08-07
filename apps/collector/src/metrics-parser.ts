import { parseLocalizedNumber } from "./number-normalizer.js";
import type { RawCampaignMetrics } from "./raw-campaign-metrics.js";

export interface ParsedCampaignMetrics {
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
  cpc: number;
  cpm: number;
  reach: number;
  rawPayload: Record<string, unknown>;
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
    return {
      impressions: parseLocalizedNumber(raw.impressions) ?? 0,
      clicks: parseLocalizedNumber(raw.clicks) ?? 0,
      spend: parseLocalizedNumber(raw.spend) ?? 0,
      ctr: parseLocalizedNumber(raw.ctr) ?? 0,
      cpc: parseLocalizedNumber(raw.cpc) ?? 0,
      cpm: parseLocalizedNumber(raw.cpm) ?? 0,
      reach: parseLocalizedNumber(raw.reach) ?? 0,
      rawPayload: { ...raw },
    };
  }
}
