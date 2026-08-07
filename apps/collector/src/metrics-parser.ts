import type { InsightSnapshot } from "@repo/shared";

/**
 * Loose input shape — deliberately permissive, since real input will
 * later come from either scraped DOM text (Playwright) or a typed
 * Meta API response, and both need to funnel through the same shape.
 */
export interface RawMetricsInput {
  campaignId: string;
  capturedAt?: Date;
  impressions?: number;
  clicks?: number;
  spend?: number;
  ctr?: number;
  cpc?: number;
  cpm?: number;
  reach?: number;
  raw?: Record<string, unknown>;
}

/**
 * Sprint 4 scope: normalize mocked/raw input into a typed
 * InsightSnapshot shape. No real parsing logic (scraped text
 * cleanup, number formatting, locale handling, etc.) yet — that
 * arrives once PlaywrightCollector actually reads Meta's UI.
 */
export class MetricsParser {
  parse(input: RawMetricsInput): Omit<InsightSnapshot, "id"> {
    return {
      campaignId: input.campaignId,
      capturedAt: input.capturedAt ?? new Date(),
      impressions: input.impressions ?? 0,
      clicks: input.clicks ?? 0,
      spend: input.spend ?? 0,
      ctr: input.ctr ?? 0,
      cpc: input.cpc ?? 0,
      cpm: input.cpm ?? 0,
      reach: input.reach ?? 0,
      rawPayload: input.raw ?? null,
    };
  }
}
