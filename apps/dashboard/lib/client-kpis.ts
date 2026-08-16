import {
  SqliteAdAccountRepository,
  SqliteCampaignRepository,
  SqliteInsightSnapshotRepository,
} from "@repo/database";
import type { AdAccount, Campaign, DashboardKpiKey, InsightSnapshot } from "@repo/shared";
import { KPI_CATALOG } from "@repo/shared";
import { getDatabase } from "@/lib/db";

export interface ClientCampaignKpi {
  campaignId: string;
  campaignName: string;
  adAccountId: string;
  adAccountName: string;
  values: Record<DashboardKpiKey, number>;
  capturedAt: Date;
}

export interface ClientKpis {
  values: Record<DashboardKpiKey, number>;
  campaignCount: number;
  campaigns: ClientCampaignKpi[];
}

// Metrics that are genuinely additive across campaigns (counts and the
// total spend). The remaining KPI keys are rates/ratios computed from
// these totals (see deriveClientMetrics) — summing per-campaign rates
// would produce nonsense.
export const SUMMABLE_KEYS: readonly DashboardKpiKey[] = [
  "spend",
  "impressions",
  "reach",
  "clicks",
  "clicksAll",
  "linkClicks",
  "uniqueClicks",
  "landingPageViews",
  "outboundClicks",
  "leads",
  "messagesStarted",
  "messagesContacts",
  "results",
  "postReactions",
  "postComments",
];

export function zeroKpiValues(): Record<DashboardKpiKey, number> {
  const values = {} as Record<DashboardKpiKey, number>;
  for (const def of KPI_CATALOG) {
    values[def.key] = 0;
  }
  return values;
}

export function snapshotToValues(snapshot: InsightSnapshot): Record<DashboardKpiKey, number> {
  return {
    spend: snapshot.spend,
    impressions: snapshot.impressions,
    reach: snapshot.reach,
    frequency: snapshot.frequency,
    clicks: snapshot.clicks,
    clicksAll: snapshot.clicksAll,
    linkClicks: snapshot.linkClicks,
    uniqueClicks: snapshot.uniqueClicks,
    ctr: snapshot.ctr,
    uniqueCtr: snapshot.uniqueCtr,
    cpc: snapshot.cpc,
    cpm: snapshot.cpm,
    landingPageViews: snapshot.landingPageViews,
    outboundClicks: snapshot.outboundClicks,
    outboundCtr: snapshot.outboundCtr,
    leads: snapshot.leads,
    messagesStarted: snapshot.messagesStarted,
    messagesContacts: snapshot.messagesContacts,
    results: snapshot.results,
    costPerResult: snapshot.costPerResult,
    postReactions: snapshot.postReactions,
    postComments: snapshot.postComments,
  };
}

/**
 * Rates/ratios that must be derived from client-level totals instead of
 * summed: e.g. client CTR = total clicks / total impressions * 100, exactly
 * how the pre-configuration dashboard computed it.
 */
export function deriveClientMetrics(totals: Record<DashboardKpiKey, number>): Record<DashboardKpiKey, number> {
  const {
    impressions,
    reach,
    clicks,
    uniqueClicks,
    outboundClicks,
    spend,
    results,
  } = totals;

  return {
    ...totals,
    ctr: impressions === 0 ? 0 : (clicks / impressions) * 100,
    uniqueCtr: reach === 0 ? 0 : (uniqueClicks / reach) * 100,
    outboundCtr: impressions === 0 ? 0 : (outboundClicks / impressions) * 100,
    cpc: clicks === 0 ? 0 : spend / clicks,
    cpm: impressions === 0 ? 0 : (spend * 1000) / impressions,
    costPerResult: results === 0 ? 0 : spend / results,
    frequency: reach === 0 ? 0 : impressions / reach,
  };
}

/**
 * Server-only. Computes client-level KPIs from the latest cumulative
 * snapshot of every campaign. Snapshots are cumulative per campaign,
 * so each campaign contributes exactly its latest snapshot — multiple
 * snapshots of the same campaign are never summed.
 *
 * Aggregation and visibility are separate concerns: this function
 * always computes the full KPI set; the caller decides which of those
 * KPIs are actually shown to the client.
 */
export async function getClientKpis(clientId: string): Promise<ClientKpis> {
  const db = getDatabase();
  const adAccountRepo = new SqliteAdAccountRepository(db);
  const campaignRepo = new SqliteCampaignRepository(db);
  const snapshotRepo = new SqliteInsightSnapshotRepository(db);

  const adAccounts: AdAccount[] = await adAccountRepo.findByClient(clientId);

  const campaigns: ClientCampaignKpi[] = [];
  const totals = zeroKpiValues();

  for (const adAccount of adAccounts) {
    const accountCampaigns: Campaign[] = await campaignRepo.findByAdAccount(
      adAccount.id
    );

    for (const campaign of accountCampaigns) {
      const latest = await snapshotRepo.findLatestForCampaign(campaign.id);
      if (!latest) continue;

      const values = snapshotToValues(latest);
      for (const key of SUMMABLE_KEYS) {
        totals[key] += values[key];
      }

      campaigns.push({
        campaignId: campaign.id,
        campaignName: campaign.name,
        adAccountId: adAccount.id,
        adAccountName: adAccount.name,
        values,
        capturedAt: latest.capturedAt,
      });
    }
  }

  return {
    values: deriveClientMetrics(totals),
    campaignCount: campaigns.length,
    campaigns,
  };
}