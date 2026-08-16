import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import type { PricingMetric, PricingRule } from "@repo/shared";
import { PricingVerificationTable } from "@/components/admin/pricing-verification-table";
import type { ClientPricingVerification } from "@/lib/pricing-admin";
import { canViewPricing } from "@/lib/pricing-admin";

function makeRule(
  metric: PricingMetric,
  overrides: Partial<PricingRule> = {}
): PricingRule {
  return {
    id: `rule-${metric}`,
    clientId: "client-1",
    metric,
    percentageMarkup: null,
    fixedMarkup: null,
    minimumCustomerValue: null,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeVerification(
  entries: {
    metric: PricingMetric;
    rawValue: number;
    rule: PricingRule | null;
    customerValue?: number;
  }[]
): ClientPricingVerification {
  return {
    clientId: "client-1",
    clientName: "Test Client",
    priced: entries.map(({ metric, rawValue, rule, customerValue }) => ({
      metric,
      rawValue,
      rule,
      // Customer value matches the pricing domain output; the table only
      // renders it, it never recomputes it.
      customerValue: customerValue ?? rawValue,
    })),
  };
}

test("pricing verification: super admin can access, admin and client cannot", () => {
  assert.equal(canViewPricing({ role: "super_admin" }), true);
  assert.equal(canViewPricing({ role: "admin" }), false);
  assert.equal(canViewPricing({ role: "client" }), false);
  assert.equal(canViewPricing(null), false);
});

test("pricing verification: no pricing rule shows raw as customer value", () => {
  const html = renderToStaticMarkup(
    <PricingVerificationTable
      verification={makeVerification([
        { metric: "cpm", rawValue: 0.5, rule: null },
      ])}
    />
  );

  assert.ok(html.includes("هزینه به ازای هزار نمایش (CPM)"));
  assert.ok(html.includes("بدون قانون قیمت‌گذاری"));
  assert.ok(html.includes("بدون تغییر"));
  // Raw value rendered as customer value (raw unchanged).
  assert.ok(html.includes("۰٫۵۰"));
});

test("pricing verification: fixed markup shows raw and customer correctly", () => {
  const rule = makeRule("cpm", { fixedMarkup: 1.0 });
  const html = renderToStaticMarkup(
    <PricingVerificationTable
      verification={makeVerification([
        { metric: "cpm", rawValue: 0.5, rule, customerValue: 1.5 },
      ])}
    />
  );

  assert.ok(html.includes("۰٫۵۰"));
  assert.ok(html.includes("۱٫۵۰"));
  assert.ok(html.includes("قیمت‌گذاری اعمال شد"));
});

test("pricing verification: percentage markup shows raw and customer correctly", () => {
  const rule = makeRule("cpc", { percentageMarkup: 0.4 });
  const html = renderToStaticMarkup(
    <PricingVerificationTable
      verification={makeVerification([
        { metric: "cpc", rawValue: 0.25, rule, customerValue: 0.35 },
      ])}
    />
  );

  assert.ok(html.includes("هزینه به ازای کلیک (CPC)"));
  assert.ok(html.includes("۰٫۲۵"));
  assert.ok(html.includes("۰٫۳۵"));
  // "+40%" is shown as a rule component.
  assert.ok(html.includes("٪"));
  assert.ok(html.includes("قیمت‌گذاری اعمال شد"));
});

test("pricing verification: minimum customer value is reflected", () => {
  const rule = makeRule("cpm", { minimumCustomerValue: 0.75 });
  const html = renderToStaticMarkup(
    <PricingVerificationTable
      verification={makeVerification([
        { metric: "cpm", rawValue: 0.5, rule, customerValue: 0.75 },
      ])}
    />
  );

  assert.ok(html.includes("حداقل"));
  assert.ok(html.includes("۰٫۷۵"));
});

test("pricing verification: UI uses the effective rule selected by effectiveFrom", () => {
  const older = makeRule("cpm", {
    fixedMarkup: 1.0,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
  });
  const newer = makeRule("cpm", {
    fixedMarkup: 2.0,
    effectiveFrom: new Date("2026-02-01T00:00:00.000Z"),
  });

  // Simulate the effective rule the pricing service selected (newer one).
  const html = renderToStaticMarkup(
    <PricingVerificationTable
      verification={makeVerification([
        { metric: "cpm", rawValue: 0.5, rule: newer, customerValue: 2.5 },
      ])}
    />
  );

  // The effective (newer) rule's components are shown; the stale older
  // rule does not appear.
  assert.ok(html.includes("۲٫۰۰"));
  assert.ok(!html.includes("۱٫۰۰"));
});

test("pricing verification: raw Meta value is never modified", () => {
  const rule = makeRule("spend", { percentageMarkup: 0.1, fixedMarkup: 5 });
  const rawValue = 100;
  const verification = makeVerification([
    { metric: "spend", rawValue, rule, customerValue: 110 },
  ]);

  const html = renderToStaticMarkup(
    <PricingVerificationTable verification={verification} />
  );

  // The raw value 100 is rendered unchanged.
  assert.ok(html.includes("۱۰۰"));
  assert.equal(verification.priced[0].rawValue, rawValue);
});

test("pricing verification: non-cost KPIs never appear as priced metrics", () => {
  const html = renderToStaticMarkup(
    <PricingVerificationTable
      verification={makeVerification([
        { metric: "spend", rawValue: 100, rule: null },
        { metric: "cpc", rawValue: 0.25, rule: null },
        { metric: "cpm", rawValue: 0.5, rule: null },
        { metric: "costPerResult", rawValue: 2.08, rule: null },
      ])}
    />
  );

  // The four pricing metrics are listed.
  assert.ok(html.includes("هزینه تبلیغات"));
  assert.ok(html.includes("هزینه به ازای کلیک (CPC)"));
  assert.ok(html.includes("هزینه به ازای هزار نمایش (CPM)"));
  assert.ok(html.includes("هزینه به ازای نتیجه"));

  // Non-cost KPIs are never listed.
  assert.ok(!html.includes("نمایش‌ها"));
  assert.ok(!html.includes("نرخ کلیک (CTR)"));
  assert.ok(!html.includes("دسترسی"));
  assert.ok(!html.includes("فرکانس"));
});