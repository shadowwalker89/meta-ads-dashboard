import {
  SqliteAdAccountRepository,
  SqliteCampaignRepository,
  SqliteInsightSnapshotRepository,
} from "@repo/database";
import type { DashboardKpiKey, User } from "@repo/shared";
import { requireClientAccess } from "@/lib/access";
import {
  SUMMABLE_KEYS,
  deriveClientMetrics,
  snapshotToValues,
  zeroKpiValues,
  type ClientCampaignKpi,
} from "@/lib/client-kpis";
import { mergePricedValues } from "@/lib/client-pricing-view";
import { getClientPricedKpis } from "@/lib/pricing";
import { getDatabase } from "@/lib/db";
import {
  percentageChange,
  previousPeriod,
  reportingRangeForDays,
  type DashboardRange,
} from "@/lib/dashboard-period";

type Db = ReturnType<typeof getDatabase>;

export type { DashboardRange } from "@/lib/dashboard-period";

export interface ClientDashboardPeriod {
  /** The selected reporting window (by snapshot captured_at). */
  range: DashboardRange;
  /** The equal-length period immediately preceding `range`. */
  previousRange: DashboardRange;
  /**
   * Percentage change of the current period vs the previous period, per
   * KPI key. `null` means the comparison is unavailable or untrustworthy
   * (no previous reading, zero denominator, or a rolling-window artifact
   * where a cumulative count/spend metric decreased between readings).
   * Rates (CTR/CPC/CPM/...) compare normally — they may legitimately
   * go down. Never NaN or Infinity.
   */
  change: Record<DashboardKpiKey, number | null>;
}

export interface ClientDashboardData {
  /**
   * Customer-facing KPI totals: raw aggregated metrics with the pricing
   * layer applied (cost metrics carry their customer value) and rates
   * (CTR/CPC/CPM/...) derived from the aggregated raw metrics.
   */
  values: Record<DashboardKpiKey, number>;
  /** Number of campaigns that contributed data (had a snapshot in range). */
  campaignCount: number;
  /**
   * Number of snapshots aggregated — always == the number of campaigns
   * with a snapshot in range, because each campaign contributes exactly
   * its latest snapshot (cumulative semantics).
   */
  snapshotCount: number;
  campaigns: ClientCampaignKpi[];
  period: ClientDashboardPeriod;
}

/**
 * Default reporting window: the trailing 30 days, matching the Meta Ads
 * Manager campaign table default that the collector reads from. The
 * dashboard page always passes an explicit 7/30/90 range; this is only
 * the safe fallback for other callers.
 */
export function defaultDashboardRange(now: Date = new Date()): DashboardRange {
  return reportingRangeForDays(30, now);
}

interface CampaignMeta {
  name: string;
  adAccountId: string;
  adAccountName: string;
}

interface AggregatedRead {
  totals: Record<DashboardKpiKey, number>;
  campaigns: ClientCampaignKpi[];
  snapshotCount: number;
}

/**
 * Latest-per-campaign aggregation for one window. Snapshots are
 * cumulative period totals per campaign, so each campaign contributes
 * exactly its latest snapshot within the range — multiple snapshots of
 * the same campaign are never summed. Shared by the current and the
 * previous period so the aggregation rule lives in exactly one place.
 */
async function aggregateForRange(
  snapshotRepo: SqliteInsightSnapshotRepository,
  campaignMeta: Map<string, CampaignMeta>,
  campaignIds: string[],
  range: DashboardRange
): Promise<AggregatedRead> {
  const snapshots = await snapshotRepo.findLatestForCampaigns(
    campaignIds,
    range.from,
    range.to
  );

  const totals = zeroKpiValues();
  const campaigns: ClientCampaignKpi[] = [];
  for (const snapshot of snapshots) {
    const meta = campaignMeta.get(snapshot.campaignId);
    if (!meta) continue;

    const values = snapshotToValues(snapshot);
    for (const key of SUMMABLE_KEYS) {
      totals[key] += values[key];
    }

    campaigns.push({
      campaignId: snapshot.campaignId,
      campaignName: meta.name,
      adAccountId: meta.adAccountId,
      adAccountName: meta.adAccountName,
      values,
      capturedAt: snapshot.capturedAt,
    });
  }

  return { totals, campaigns, snapshotCount: snapshots.length };
}

/**
 * Applies the pricing layer to a raw KPI map, reusing the exact same
 * logic as getClientPricingView (getClientPricedKpis + mergePricedValues).
 * Pricing is applied at `at` so the effective rules align with the
 * reporting window being shown.
 */
async function priceValues(
  clientId: string,
  rawValues: Record<DashboardKpiKey, number>,
  at: Date,
  db: Db
): Promise<Record<DashboardKpiKey, number>> {
  const priced = await getClientPricedKpis(clientId, rawValues, at, undefined, db);
  return mergePricedValues(rawValues, priced.byMetric);
}

/**
 * Server-only. The single authorized read path for the client dashboard.
 *
 * Every clientId is verified through the central access boundary
 * (requireClientAccess) before any data is read — a clientId arriving
 * from request input is never trusted here.
 *
 * Aggregation follows the documented snapshot semantics: snapshots are
 * cumulative period totals per campaign, so each campaign contributes
 * exactly its latest snapshot within the range. The current period and
 * the immediately preceding equal-length period are aggregated
 * independently with the same rule, then compared.
 *
 * The previous-period comparison is deliberately conservative:
 *   - count/spend metrics (spend, impressions, clicks, linkClicks,
 *     reach, ...) are expected to be monotonic under cumulative
 *     semantics. If the current reading is LOWER than the previous one,
 *     the cumulative basis changed (Meta's rolling window rolled), so
 *     the comparison is untrustworthy and reported as null — never a
 *     fabricated negative trend.
 *   - derived rate metrics (CTR/CPC/CPM/...) compare normally because
 *     they can legitimately decrease; percentageChange still guards
 *     against zero/missing denominators (null, never NaN/Infinity).
 *
 * The pricing layer is applied exactly as getClientPricingView does to
 * BOTH periods, so the displayed change is consistent with the displayed
 * (customer) value. Nothing is reimplemented here.
 */
export async function getClientDashboardData(
  user: Pick<User, "role" | "id" | "clientId">,
  clientId: string,
  db: Db = getDatabase(),
  range: DashboardRange = defaultDashboardRange()
): Promise<ClientDashboardData> {
  await requireClientAccess(user, clientId, db);

  const adAccountRepo = new SqliteAdAccountRepository(db);
  const campaignRepo = new SqliteCampaignRepository(db);
  const snapshotRepo = new SqliteInsightSnapshotRepository(db);

  const adAccounts = await adAccountRepo.findByClient(clientId);

  const campaignIds: string[] = [];
  const campaignMeta = new Map<string, CampaignMeta>();
  for (const adAccount of adAccounts) {
    const campaigns = await campaignRepo.findByAdAccount(adAccount.id);
    for (const campaign of campaigns) {
      campaignMeta.set(campaign.id, {
        name: campaign.name,
        adAccountId: adAccount.id,
        adAccountName: adAccount.name,
      });
      campaignIds.push(campaign.id);
    }
  }

  const current = await aggregateForRange(
    snapshotRepo,
    campaignMeta,
    campaignIds,
    range
  );
  const previousRange = previousPeriod(range);
  const previous = await aggregateForRange(
    snapshotRepo,
    campaignMeta,
    campaignIds,
    previousRange
  );

  const currentRaw = deriveClientMetrics(current.totals);
  const previousRaw = deriveClientMetrics(previous.totals);

  const values = await priceValues(clientId, currentRaw, range.to, db);
  const previousValues = await priceValues(clientId, previousRaw, range.to, db);

  const change = {} as Record<DashboardKpiKey, number | null>;
  for (const key of Object.keys(currentRaw) as DashboardKpiKey[]) {
    if (SUMMABLE_KEYS.includes(key)) {
      change[key] =
        current.totals[key] < previous.totals[key]
          ? null
          : percentageChange(values[key], previousValues[key]);
    } else {
      change[key] = percentageChange(values[key], previousValues[key]);
    }
  }

  const pricedCampaigns: ClientCampaignKpi[] = [];
  for (const campaign of current.campaigns) {
    const pricedCampaign = await priceValues(clientId, campaign.values, range.to, db);
    pricedCampaigns.push({
      ...campaign,
      values: pricedCampaign,
    });
  }

  return {
    values,
    campaignCount: current.campaigns.length,
    snapshotCount: current.snapshotCount,
    campaigns: pricedCampaigns,
    period: {
      range,
      previousRange,
      change,
    },
  };
}