import type { PricingRule } from "@repo/shared";

const dateFormatter = new Intl.DateTimeFormat("fa-IR", {
  year: "numeric",
  month: "long",
  day: "numeric",
});
const percentFormatter = new Intl.NumberFormat("fa-IR", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const currencyFormatter = new Intl.NumberFormat("fa-IR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Renders the effective date of a pricing rule in the UI's fa-IR format.
 * Shared by every pricing surface (verification, configuration) so the
 * date format is always identical.
 */
export function formatRuleEffectiveDate(date: Date): string {
  return dateFormatter.format(date);
}

/**
 * Renders the components of a pricing rule as a compact, human-readable
 * list. Null components are omitted. This only formats what the pricing
 * domain stored — it never recomputes the customer value.
 */
export function formatRuleComponents(
  rule: Pick<
    PricingRule,
    "percentageMarkup" | "fixedMarkup" | "minimumCustomerValue"
  >
): string[] {
  const parts: string[] = [];
  if (rule.percentageMarkup !== null) {
    parts.push(`+${percentFormatter.format(rule.percentageMarkup)}`);
  }
  if (rule.fixedMarkup !== null) {
    parts.push(`+${currencyFormatter.format(rule.fixedMarkup)}`);
  }
  if (rule.minimumCustomerValue !== null) {
    parts.push(`حداقل ${currencyFormatter.format(rule.minimumCustomerValue)}`);
  }
  return parts;
}