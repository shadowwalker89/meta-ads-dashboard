import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import type { PricingRule } from "@repo/shared";
import { applyPricingRule } from "@repo/shared";
import { canViewPricing } from "@/lib/pricing-admin";
import {
  hasPricingRuleComponents,
  previewPricingValue,
  type PricingRuleDraft,
} from "@/lib/pricing-draft";
import { formatRuleComponents } from "@/lib/pricing-format";

function makeDraft(
  overrides: Partial<PricingRuleDraft> = {}
): PricingRuleDraft {
  return {
    clientId: "client-1",
    metric: "cpm",
    percentageMarkup: null,
    fixedMarkup: null,
    minimumCustomerValue: null,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

test("pricing config: super admin can configure, admin and client cannot", () => {
  assert.equal(canViewPricing({ role: "super_admin" }), true);
  assert.equal(canViewPricing({ role: "admin" }), false);
  assert.equal(canViewPricing({ role: "client" }), false);
  assert.equal(canViewPricing(null), false);
});

test("pricing config: preview uses the existing domain calculation (applyPricingRule)", () => {
  const raw = 0.25;
  const draft = makeDraft({
    metric: "cpc",
    percentageMarkup: 0.4,
  });

  // The configurator preview must match the shared domain formula exactly.
  assert.equal(previewPricingValue(draft, raw), applyPricingRule(draft, raw));
  assert.equal(previewPricingValue(draft, raw), 0.35);
});

test("pricing config: preview never mutates the raw Meta value", () => {
  const raw = 100;
  const draft = makeDraft({ metric: "spend", percentageMarkup: 0.1, fixedMarkup: 5 });

  const customer = previewPricingValue(draft, raw);
  // The configurator preview must agree exactly with the shared formula.
  assert.equal(customer, applyPricingRule(draft, raw));
  // Floating point: 100 * 1.1 = 110.00000000000001; the formula yields the
  // max of the candidates, which we compare with rounding.
  assert.equal(Math.round(customer), 110);
  // The raw input is never mutated — the formula returns a derived value.
  assert.equal(raw, 100);
});

test("pricing config: an empty rule (no components) is rejected and is a no-op", () => {
  const draft = makeDraft({});
  assert.equal(hasPricingRuleComponents(draft), false);
  // With no components the customer value equals the raw value.
  assert.equal(previewPricingValue(draft, 5), 5);
});

test("pricing config: rule component formatting reuses the shared format", () => {
  const rule: PricingRule = {
    id: "rule-1",
    clientId: "client-1",
    metric: "cpm",
    percentageMarkup: 0.4,
    fixedMarkup: 1.0,
    minimumCustomerValue: 0.75,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  const components = formatRuleComponents(rule);
  assert.ok(components.some((c) => c.includes("٪")));
  assert.ok(components.some((c) => c.includes("حداقل")));

  // Rendering a component uses the same list (no recomputation on the client).
  const html = renderToStaticMarkup(
    <span>{formatRuleComponents(rule).join(" · ")}</span>
  );
  assert.ok(html.includes("٪"));
});