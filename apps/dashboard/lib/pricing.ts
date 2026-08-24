import type {
  DashboardKpiKey,
  PricingMetric,
  PricingRule,
} from "@repo/shared";
import {
  PRICABLE_METRICS,
  applyPricingRule,
  selectApplicablePricingRule,
} from "@repo/shared";
import { getDatabase, getRepositories } from "@/lib/db";

export interface PricedKpi {
  metric: PricingMetric;
  rawValue: number;
  rule: PricingRule | null;
  customerValue: number;
}

export interface ClientPricedKpis {
  /** Only pricable (cost) metrics are priced; everything else is untouched. */
  priced: PricedKpi[];
  /**
   * For every pricable metric, the three-layer picture: raw Meta value,
   * the applied rule (null = none effective), and the customer value.
   * Non-pricable metrics are deliberately excluded — they are never
   * marked up and are returned to the client as raw.
   */
  byMetric: Record<PricingMetric, PricedKpi>;
}

/**
 * Server-only. Computes the three pricing layers for a client's raw KPI
 * values at a point in time:
 *
 *   customerValue = max(
 *     rawValue + fixedMarkup,
 *     rawValue * (1 + percentageMarkup),
 *     minimumCustomerValue
 *   )
 *
 * The applicable rule for each metric is the newest rule whose
 * effectiveFrom is <= at. When no rule is effective yet, customerValue
 * equals the raw Meta value (the rule field is null) — a client with no
 * pricing configured sees identical values to before pricing existed.
 *
 * Raw Meta values are never modified by this function; they are only
 * read. Use the byMetric map to render the admin's Meta Raw / Markup /
 * Customer Value view.
 */
export async function getClientPricedKpis(
  clientId: string,
  rawValues: Partial<Record<DashboardKpiKey, number>>,
  at: Date = new Date(),
  preloadedRules?: readonly PricingRule[],
  db: ReturnType<typeof getDatabase> = getDatabase()
): Promise<ClientPricedKpis> {
  const { pricingRuleRepository: repo } = getRepositories(db);
  const rules =
    preloadedRules ?? (await repo.findByClient(clientId));

  const priced: PricedKpi[] = [];
  const byMetric = {} as Record<PricingMetric, PricedKpi>;

  for (const metric of PRICABLE_METRICS) {
    const rawValue = rawValues[metric] ?? 0;
    const rule = selectApplicablePricingRule(rules, clientId, metric, at);
    const customerValue = rule ? applyPricingRule(rule, rawValue) : rawValue;

    const entry: PricedKpi = { metric, rawValue, rule, customerValue };
    priced.push(entry);
    byMetric[metric] = entry;
  }

  return { priced, byMetric };
}