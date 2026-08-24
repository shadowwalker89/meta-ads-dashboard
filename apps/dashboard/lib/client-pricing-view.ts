import type {
  DashboardKpiKey,
  PricingMetric,
  PricingRule,
} from "@repo/shared";
import { PRICABLE_METRICS } from "@repo/shared";
import type { ClientCampaignKpi, ClientKpis } from "@/lib/client-kpis";
import { getClientKpis } from "@/lib/client-kpis";
import { getClientPricedKpis, type PricedKpi } from "@/lib/pricing";
import { getRepositories } from "@/lib/db";

export interface ClientPricingView {
  values: Record<DashboardKpiKey, number>;
  campaignCount: number;
  campaigns: ClientCampaignKpi[];
}

/**
 * Merges the pricing layer into a raw KPI value map, producing ONLY the
 * customer-facing numbers the dashboard is allowed to show.
 *
 * For pricable (cost) metrics the customerValue replaces the raw value;
 * every other metric keeps its raw Meta value. No pricing rule, markup
 * percentage, fixed markup, minimum value, or raw cost value is ever
 * present in the returned map — this is the client's data boundary.
 *
 * Pure and synchronous: callers pass the pre-computed priced layer (from
 * getClientPricedKpis) so no pricing logic is duplicated here.
 */
export function mergePricedValues(
  raw: Partial<Record<DashboardKpiKey, number>>,
  byMetric: Record<PricingMetric, PricedKpi>
): Record<DashboardKpiKey, number> {
  const values = {} as Record<DashboardKpiKey, number>;
  for (const key of Object.keys(raw) as DashboardKpiKey[]) {
    values[key] = raw[key] ?? 0;
  }
  for (const metric of PRICABLE_METRICS) {
    values[metric] = byMetric[metric].customerValue;
  }
  return values;
}

/**
 * Server-only. Loads the client-facing KPI view: raw client KPIs (read
 * from the existing aggregation, never mutated) with the pricing layer
 * applied so cost metrics carry their customer value.
 *
 * Rules are loaded once and reused for both the client totals and every
 * campaign, so rule selection is consistent across the whole dashboard.
 * The pricing calculation is the shared domain logic via
 * getClientPricedKpis — nothing is reimplemented here. When no pricing
 * rule exists for a metric, getClientPricedKpis returns customerValue ==
 * rawValue, so missing pricing is fully transparent.
 *
 * The returned object contains only numbers and campaign identity
 * metadata — never pricing rule details.
 */
export async function getClientPricingView(
  clientId: string,
  at: Date = new Date()
): Promise<ClientPricingView> {
  const ruleRepo = getRepositories().pricingRuleRepository;
  const rules: readonly PricingRule[] = await ruleRepo.findByClient(clientId);

  const kpis: ClientKpis = await getClientKpis(clientId);

  const pricedTotals = await getClientPricedKpis(
    clientId,
    kpis.values,
    at,
    rules
  );
  const values = mergePricedValues(kpis.values, pricedTotals.byMetric);

  const campaigns: ClientCampaignKpi[] = [];
  for (const campaign of kpis.campaigns) {
    const pricedCampaign = await getClientPricedKpis(
      clientId,
      campaign.values,
      at,
      rules
    );
    campaigns.push({
      campaignId: campaign.campaignId,
      campaignName: campaign.campaignName,
      adAccountId: campaign.adAccountId,
      adAccountName: campaign.adAccountName,
      // capturedAt and raw snapshot data are preserved unchanged.
      values: mergePricedValues(campaign.values, pricedCampaign.byMetric),
      capturedAt: campaign.capturedAt,
    });
  }

  return {
    values,
    campaignCount: kpis.campaignCount,
    campaigns,
  };
}