import type { DashboardKpiKey } from "@repo/shared";
import { KPI_CATALOG_BY_KEY } from "@repo/shared";
import type { ClientCampaignKpi } from "@/lib/client-kpis";

/**
 * Pure chart logic for the campaign-comparison chart.
 *
 * The chart is deliberately NOT a time-series: it compares campaigns by
 * their LATEST cumulative reading inside the selected reporting window.
 * Values are the customer-facing (priced) numbers already resolved by
 * getClientDashboardData — this module only projects and sorts them, it
 * never reads storage, never recomputes pricing, and never interprets a
 * cumulative/as-of value as daily activity.
 */

/**
 * The only metrics the chart supports. Deliberately the four
 * campaign-level metrics that are meaningful to compare as bars; adding
 * a metric here means adding it to the catalog-driven label lookup too.
 */
export const CHART_METRICS: readonly DashboardKpiKey[] = [
  "spend",
  "impressions",
  "clicks",
  "linkClicks",
];

/**
 * The chartable metrics for a client: the supported metric set
 * intersected with the client's resolved visible KPIs. A metric the
 * client's KPI configuration hides is never offered in the chart, so
 * chart and dashboard visibility stay consistent.
 */
export function resolveChartableMetrics(
  visibleKpis: readonly DashboardKpiKey[]
): DashboardKpiKey[] {
  return CHART_METRICS.filter((metric) => visibleKpis.includes(metric));
}

export interface CampaignChartRow {
  /** Customer-visible campaign name (already displayed in the dashboard table). */
  label: string;
  /** The customer-facing value for the selected metric in the reporting window. */
  value: number;
}

/**
 * Rounds a metric value to remove binary floating-point noise
 * (e.g. 50 * 1.1 = 55.00000000000001) so the chart's data points equal
 * the customer-facing values the dashboard displays. Genuine precision
 * of rates/ratios is preserved (max 6 decimals); the chart's supported
 * metrics are currency + integer counts, so this never distorts.
 */
function roundMetricValue(value: number): number {
  return Math.round((value + Number.EPSILON) * 1e6) / 1e6;
}

/**
 * Projects campaigns into sorted chart rows for one metric. Sorted
 * descending so the top campaigns are visible first (and the scroll
 * container absorbs the rest — many campaigns render gracefully).
 * Values come straight from the priced campaign rows (rounded to the
 * displayed customer value); nothing is recomputed here. Empty input
 * yields an empty array.
 */
export function buildCampaignChartRows(
  campaigns: readonly Pick<ClientCampaignKpi, "campaignName" | "values">[],
  metric: DashboardKpiKey
): CampaignChartRow[] {
  return campaigns
    .map((campaign) => ({
      label: campaign.campaignName,
      value: roundMetricValue(campaign.values[metric] ?? 0),
    }))
    .sort((a, b) => b.value - a.value);
}

/** The catalog label for a chart metric (e.g. "هزینه تبلیغات"). */
export function getChartMetricLabel(metric: DashboardKpiKey): string {
  return KPI_CATALOG_BY_KEY.get(metric)?.label ?? metric;
}

/**
 * Percentage width for a bar, scaled against the largest row value.
 * A zero or empty dataset yields 0 for every bar (empty tracks) — never
 * NaN/Infinity.
 */
export function barWidthPercent(value: number, max: number): number {
  if (max <= 0 || !Number.isFinite(max)) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}