import type { Page } from "playwright";
import type { RawCampaignMetrics } from "./raw-campaign-metrics.js";

/**
 * Placeholder abstraction for reading the campaign table out of Meta
 * Ads Manager's UI. Real selectors are intentionally NOT guessed here
 * (per Sprint 5 rules) — this needs the real Meta DOM inspected first.
 *
 * The seam is real and wired end-to-end (PlaywrightCollector calls
 * this, its output flows into MetricsParser and Campaign Discovery);
 * only the body of this one function needs to be filled in once real
 * selectors are known.
 */
export async function scrapeCampaignTable(_page: Page): Promise<RawCampaignMetrics[]> {
  console.warn(
    "[Collector] scrapeCampaignTable() is a placeholder — real Meta Ads selectors are not implemented yet"
  );
  return [];
}
