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

type Db = ReturnType<typeof getDatabase>;

export interface DashboardRange {
  from: Date;
  to: Date;
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
}

/**
 * Default reporting window: the trailing 30 days, matching the Meta Ads
 * Manager campaign table default that the collector reads from.
 */
export function defaultDashboardRange(now: Date = new Date()): DashboardRange {
  return {
    from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    to: now,
  };
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
 * exactly its latest snapshot within the range (older snapshots of the
 * same campaign are never summed). The repository returns one row per
 * campaign and this service sums the raw metrics across campaigns, then
 * derives rates from those totals.
 *
 * The pricing layer is applied exactly as the existing
 * getClientPricingView does (getClientPricedKpis + mergePricedValues)
 * at the end of the reporting window, so cost metrics show their
 * customer value and raw cost is never exposed.
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
  const campaignMeta = new Map<
    string,
    { name: string; adAccountId: string; adAccountName: string }
  >();
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

  const rawValues = deriveClientMetrics(totals);

  // Pricing is applied at the end of the reporting window so the
  // effective rules align with the data being shown. Behavior is the
  // same as getClientPricingView — nothing is reimplemented here.
  const pricedTotals = await getClientPricedKpis(
    clientId,
    rawValues,
    range.to,
    undefined,
    db
  );
  const values = mergePricedValues(rawValues, pricedTotals.byMetric);

  const pricedCampaigns: ClientCampaignKpi[] = [];
  for (const campaign of campaigns) {
    const pricedCampaign = await getClientPricedKpis(
      clientId,
      campaign.values,
      range.to,
      undefined,
      db
    );
    pricedCampaigns.push({
      ...campaign,
      values: mergePricedValues(campaign.values, pricedCampaign.byMetric),
    });
  }

  return {
    values,
    campaignCount: campaigns.length,
    snapshotCount: snapshots.length,
    campaigns: pricedCampaigns,
  };
}
