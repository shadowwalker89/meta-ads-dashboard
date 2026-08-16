import type { DashboardKpiKey } from "./kpi-catalog";

/**
 * Pricing Foundation.
 *
 * Three conceptual layers are kept distinct everywhere in the system:
 *
 *   1. META RAW       — the value collected from Meta, stored in
 *                       InsightSnapshot. Never mutated by pricing.
 *   2. PRICING RULE   — a server-side, per-metric rule describing how
 *                       the business transforms Meta cost into
 *                       customer-facing cost.
 *   3. CUSTOMER VALUE — the final value shown to the client,
 *                       computed as:
 *
 *                       customerValue = max(
 *                         metaValue + fixedMarkup,
 *                         metaValue * (1 + percentageMarkup),
 *                         minimumCustomerValue
 *                       )
 *
 * The formula is modeled PER METRIC (not globally) because real
 * business pricing uses different markups per metric — e.g. a fixed
 * markup on CPM and a percentage markup on CPC at the same time.
 * One rule row describes the full transformation for a single metric.
 *
 * Only cost metrics are pricable. Volume/rate metrics (impressions,
 * clicks, CTR, reach, frequency, ...) are never marked up.
 *
 * Rules are effective-dated: the applicable rule for a calculation is
 * the newest rule whose effectiveFrom is <= the calculation time. To
 * change pricing you insert a new rule with a later effectiveFrom —
 * historical rules and raw Meta values are never modified.
 */

/**
 * The cost metrics the pricing system supports. Kept as an explicit,
 * typed list (not a filter on the whole KPI catalog) so the set of
 * pricable metrics is a deliberate, reviewed decision — and so
 * non-cost KPIs can never accidentally become pricable.
 */
export const PRICABLE_METRICS: readonly DashboardKpiKey[] = [
  "spend",
  "cpc",
  "cpm",
  "costPerResult",
];

export type PricingMetric = (typeof PRICABLE_METRICS)[number];

export function isPricingMetric(value: unknown): value is PricingMetric {
  return (
    typeof value === "string" &&
    (PRICABLE_METRICS as readonly string[]).includes(value)
  );
}

export interface PricingRule {
  id: string;
  /**
   * Client-scoped: pricing is a per-client business agreement. When
   * package-level (Gold/Silver/Bronze) pricing arrives later, it can
   * either seed per-client rules or introduce a package-scoped table —
   * both work without changing this model.
   */
  clientId: string;
  metric: PricingMetric;
  percentageMarkup: number | null;
  fixedMarkup: number | null;
  minimumCustomerValue: number | null;
  effectiveFrom: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * True if the rule has at least one pricing component configured.
 * A rule with all three null would be a no-op and is rejected at the
 * repository boundary.
 */
export function hasPricingComponents(rule: {
  percentageMarkup: number | null;
  fixedMarkup: number | null;
  minimumCustomerValue: number | null;
}): boolean {
  return (
    rule.percentageMarkup !== null ||
    rule.fixedMarkup !== null ||
    rule.minimumCustomerValue !== null
  );
}

/**
 * Applies a single pricing rule to a raw Meta value, returning the
 * customer-facing value. Pure and deterministic.
 *
 * customerValue = max(
 *   metaValue + fixedMarkup,
 *   metaValue * (1 + percentageMarkup),
 *   minimumCustomerValue
 * )
 *
 * Null components do not participate in the max. A metaValue of 0
 * (e.g. a campaign with no delivery yet) is handled safely: it flows
 * through the formula, so a fixedMarkup or minimumCustomerValue still
 * applies while a pure percentageMarkup yields 0.
 */
export function applyPricingRule(
  rule: Pick<
    PricingRule,
    "percentageMarkup" | "fixedMarkup" | "minimumCustomerValue"
  >,
  metaValue: number
): number {
  const candidates: number[] = [];

  if (rule.fixedMarkup !== null) {
    candidates.push(metaValue + rule.fixedMarkup);
  }
  if (rule.percentageMarkup !== null) {
    candidates.push(metaValue * (1 + rule.percentageMarkup));
  }
  if (rule.minimumCustomerValue !== null) {
    candidates.push(rule.minimumCustomerValue);
  }

  return candidates.length > 0 ? Math.max(...candidates) : metaValue;
}

/**
 * Selects the newest pricing rule applicable at the given time for the
 * given client+metric. Returns null when no rule is effective yet —
 * in that case the customer value equals the raw Meta value.
 */
export function selectApplicablePricingRule(
  rules: readonly PricingRule[],
  clientId: string,
  metric: PricingMetric,
  at: Date
): PricingRule | null {
  let selected: PricingRule | null = null;
  for (const rule of rules) {
    if (rule.clientId !== clientId) continue;
    if (rule.metric !== metric) continue;
    if (rule.effectiveFrom.getTime() > at.getTime()) continue;
    if (
      selected === null ||
      rule.effectiveFrom.getTime() > selected.effectiveFrom.getTime()
    ) {
      selected = rule;
    }
  }
  return selected;
}

/**
 * Package-level pricing DEFAULTS.
 *
 * A Package may carry default pricing for each pricable metric (the
 * same three components as a client-scoped PricingRule, WITHOUT an
 * effective date). These defaults are the starting point for a client
 * assigned to the package: they feed the existing client-scoped
 * PricingRule foundation (e.g. by seeding per-client rules on
 * assignment) — they never replace it. The PricingRule model and the
 * customer-value calculation are unchanged by this type.
 */
export interface PackagePricingDefault {
  percentageMarkup: number | null;
  fixedMarkup: number | null;
  minimumCustomerValue: number | null;
}

export type PackagePricingDefaults = Partial<
  Record<PricingMetric, PackagePricingDefault>
>;

function finiteNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Reduces arbitrary persisted JSON down to a safe PackagePricingDefaults:
 * only known pricable metrics survive, only their numeric components are
 * kept, and a per-metric config with all three components null is dropped
 * (matching hasPricingComponents). Corrupt/foreign shapes become {}.
 */
export function sanitizePackagePricingDefaults(
  input: unknown
): PackagePricingDefaults {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {};
  }

  const result: PackagePricingDefaults = {};
  for (const [key, value] of Object.entries(input)) {
    if (!isPricingMetric(key)) continue;
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      continue;
    }
    const raw = value as Record<string, unknown>;
    const cleaned: PackagePricingDefault = {
      percentageMarkup: finiteNumberOrNull(raw.percentageMarkup),
      fixedMarkup: finiteNumberOrNull(raw.fixedMarkup),
      minimumCustomerValue: finiteNumberOrNull(raw.minimumCustomerValue),
    };
    if (hasPricingComponents(cleaned)) {
      result[key] = cleaned;
    }
  }
  return result;
}