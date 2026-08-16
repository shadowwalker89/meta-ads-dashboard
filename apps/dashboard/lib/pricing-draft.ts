import type { PricingRule } from "@repo/shared";
import { applyPricingRule } from "@repo/shared";

/**
 * A pricing rule still being edited in the configurator form. Mirrors
 * the persisted PricingRule but without identity/timestamps. The client
 * configurator builds these from raw form input and passes them to the
 * existing domain calculation (applyPricingRule) for the preview — the
 * pricing formula itself is never reimplemented on the client.
 */
export interface PricingRuleDraft {
  clientId: string;
  metric: PricingRule["metric"];
  percentageMarkup: number | null;
  fixedMarkup: number | null;
  minimumCustomerValue: number | null;
  effectiveFrom: Date;
}

/**
 * True when at least one pricing component is set, i.e. the draft would
 * actually change the customer value. Delegates to the domain rule so
 * the configurator cannot drift from the persisted rule semantics.
 */
export function hasPricingRuleComponents(draft: {
  percentageMarkup: number | null;
  fixedMarkup: number | null;
  minimumCustomerValue: number | null;
}): boolean {
  return (
    draft.percentageMarkup !== null ||
    draft.fixedMarkup !== null ||
    draft.minimumCustomerValue !== null
  );
}

/**
 * Applies a draft pricing rule to a raw Meta value. Pure and identical
 * to what the persisted rule would produce — the configurator preview
 * and the real saved rule always agree.
 */
export function previewPricingValue(
  draft: PricingRuleDraft,
  rawValue: number
): number {
  return applyPricingRule(draft, rawValue);
}