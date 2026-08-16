import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  DashboardKpiKey,
  PricingMetric,
  PricingRule,
} from "@repo/shared";
import { PRICABLE_METRICS, applyPricingRule } from "@repo/shared";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { CampaignPerformanceTable } from "@/components/dashboard/campaign-performance-table";
import { mergePricedValues } from "@/lib/client-pricing-view";
import type { PricedKpi } from "@/lib/pricing";
import type { ClientCampaignKpi } from "@/lib/client-kpis";

function makeRule(metric: PricingMetric, overrides: Partial<PricingRule> = {}): PricingRule {
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

function makePriced(metric: PricingMetric, rawValue: number, rule: PricingRule | null): PricedKpi {
  return {
    metric,
    rawValue,
    rule,
    customerValue: rule ? applyPricingRule(rule, rawValue) : rawValue,
  };
}

/**
 * Builds the priced layer for all four pricable metrics from the same
 * domain formula getClientPricedKpis uses, so the merge test exercises
 * real customer values — not hand-picked fixtures.
 */
function pricedLayerFor(
  raw: Partial<Record<DashboardKpiKey, number>>,
  rules: Partial<Record<PricingMetric, PricingRule | null>>
): Record<PricingMetric, PricedKpi> {
  const byMetric = {} as Record<PricingMetric, PricedKpi>;
  for (const metric of PRICABLE_METRICS) {
    byMetric[metric] = makePriced(metric, raw[metric] ?? 0, rules[metric] ?? null);
  }
  return byMetric;
}

function rawValues(overrides: Partial<Record<DashboardKpiKey, number>> = {}): Record<DashboardKpiKey, number> {
  return {
    spend: 100,
    impressions: 10000,
    reach: 8000,
    frequency: 0,
    clicks: 500,
    clicksAll: 0,
    linkClicks: 0,
    uniqueClicks: 0,
    uniqueCtr: 0,
    ctr: 5,
    landingPageViews: 0,
    outboundClicks: 0,
    outboundCtr: 0,
    cpc: 0.25,
    cpm: 12.5,
    leads: 25,
    messagesStarted: 0,
    messagesContacts: 0,
    results: 0,
    costPerResult: 2.08,
    postReactions: 0,
    postComments: 0,
    ...overrides,
  };
}

function makeCampaign(values: Record<DashboardKpiKey, number>): ClientCampaignKpi {
  return {
    campaignId: "c1",
    campaignName: "Campaign One",
    adAccountId: "a1",
    adAccountName: "Main Account",
    values,
    capturedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

test("client pricing: a client with a pricing rule sees customer spend", () => {
  const raw = rawValues();
  const rules = { spend: makeRule("spend", { percentageMarkup: 0.1, fixedMarkup: 5 }) };
  const values = mergePricedValues(raw, pricedLayerFor(raw, rules));

  // spend: max(100+5, 100*1.1) = 110 -> customer value, not raw 100.
  // (Floating point: 100*1.1 is 110.00000000000001; round for the check.)
  assert.equal(Math.round(values.spend), 110);
  assert.notEqual(values.spend, 100);
});

test("client pricing: a client without a pricing rule sees raw spend", () => {
  const raw = rawValues();
  const values = mergePricedValues(raw, pricedLayerFor(raw, {}));

  // No rule -> customerValue equals rawValue; spend stays raw.
  assert.equal(values.spend, 100);
});

test("client pricing: a client sees customer CPC", () => {
  const raw = rawValues();
  const rules = { cpc: makeRule("cpc", { percentageMarkup: 0.4 }) };
  const values = mergePricedValues(raw, pricedLayerFor(raw, rules));

  // 0.25 * 1.4 = 0.35
  assert.equal(values.cpc, 0.35);
});

test("client pricing: a client sees customer CPM", () => {
  const raw = rawValues();
  const rules = { cpm: makeRule("cpm", { fixedMarkup: 1.0 }) };
  const values = mergePricedValues(raw, pricedLayerFor(raw, rules));

  // 12.5 + 1.0 = 13.5
  assert.equal(values.cpm, 13.5);
});

test("client pricing: a client sees customer costPerResult when the KPI is enabled", () => {
  const raw = rawValues();
  const rules = { costPerResult: makeRule("costPerResult", { percentageMarkup: 0.5 }) };
  const values = mergePricedValues(raw, pricedLayerFor(raw, rules));

  // 2.08 * 1.5 = 3.12
  assert.equal(values.costPerResult, 3.12);

  // When the admin enables the KPI, the card renders the customer value.
  const html = renderToStaticMarkup(
    <KpiCards visibleKpis={["costPerResult"]} values={values} />
  );
  assert.ok(html.includes("هزینه به ازای نتیجه"));
  assert.ok(html.includes("۳٫۱۲"));
});

test("client pricing: non-cost KPIs remain raw", () => {
  const raw = rawValues();
  const rules = { spend: makeRule("spend", { fixedMarkup: 5 }) };
  const values = mergePricedValues(raw, pricedLayerFor(raw, rules));

  assert.equal(values.impressions, 10000);
  assert.equal(values.clicks, 500);
  assert.equal(values.ctr, 5);
  assert.equal(values.reach, 8000);
  assert.equal(values.leads, 25);
});

test("client pricing: the dashboard cards render customer cost values only", () => {
  const raw = rawValues();
  const rules = { spend: makeRule("spend", { percentageMarkup: 0.1, fixedMarkup: 5 }) };
  const values = mergePricedValues(raw, pricedLayerFor(raw, rules));

  const html = renderToStaticMarkup(
    <KpiCards visibleKpis={["spend", "impressions"]} values={values} />
  );

  // Customer spend (110) is rendered, not the raw 100.
  assert.ok(html.includes("هزینه تبلیغات"));
  assert.ok(html.includes("۱۱۰"));
  assert.ok(!html.includes("۱۰۰"));
  // Non-cost KPI stays raw.
  assert.ok(html.includes("نمایش‌ها"));
  assert.ok(html.includes("۱۰٬۰۰۰"));
});

test("client pricing: the campaign table uses customer cost values", () => {
  const raw = rawValues({ spend: 50, cpc: 0.2, cpm: 8, impressions: 5000, clicks: 250, ctr: 5, leads: 10 });
  const rules = {
    spend: makeRule("spend", { percentageMarkup: 0.2 }),
    cpc: makeRule("cpc", { fixedMarkup: 0.1 }),
    cpm: makeRule("cpm", { fixedMarkup: 1.0 }),
  };
  const values = mergePricedValues(raw, pricedLayerFor(raw, rules));
  const campaign = makeCampaign(values);

  const html = renderToStaticMarkup(
    <CampaignPerformanceTable
      campaigns={[campaign]}
      visibleKpis={["spend", "cpc", "cpm"]}
    />
  );

  // Customer values: spend 50*1.2=60, cpc 0.2+0.1=0.3, cpm 8+1=9.
  assert.ok(html.includes("۶۰"));
  assert.ok(html.includes("۰٫۳۰"));
  assert.ok(html.includes("۹٫۰۰"));
});

test("client pricing: the campaign table keeps non-cost metrics raw", () => {
  const raw = rawValues({ spend: 50, impressions: 5000, clicks: 250, ctr: 5, leads: 10 });
  const rules = { spend: makeRule("spend", { percentageMarkup: 0.2 }) };
  const values = mergePricedValues(raw, pricedLayerFor(raw, rules));
  const campaign = makeCampaign(values);

  const html = renderToStaticMarkup(
    <CampaignPerformanceTable
      campaigns={[campaign]}
      visibleKpis={["spend", "impressions", "clicks", "ctr", "leads"]}
    />
  );

  // Raw values are preserved for non-cost KPIs.
  assert.ok(html.includes("۵٬۰۰۰"));
  assert.ok(html.includes("۲۵۰"));
  assert.ok(html.includes("۱۰"));
  // Customer spend (50*1.2=60) is rendered instead of the raw 50.
  assert.ok(html.includes("۶۰"));
  // The captured-at column is still rendered.
  assert.ok(html.includes("زمان جمع‌آوری"));
});

test("client pricing: pricing rule details are never exposed to the client", () => {
  const raw = rawValues();
  const rules = {
    spend: makeRule("spend", { percentageMarkup: 0.1, fixedMarkup: 5, minimumCustomerValue: 90 }),
    cpc: makeRule("cpc", { percentageMarkup: 0.4 }),
    cpm: makeRule("cpm", { fixedMarkup: 1.0 }),
  };
  const values = mergePricedValues(raw, pricedLayerFor(raw, rules));

  // The merged map contains only plain numbers — no rule object, no
  // markup/fixed/minimum fields anywhere.
  for (const key of Object.keys(values) as DashboardKpiKey[]) {
    assert.equal(typeof values[key], "number");
  }
  assert.ok(!("percentageMarkup" in values));
  assert.ok(!("fixedMarkup" in values));
  assert.ok(!("minimumCustomerValue" in values));

  // The rendered cards never leak markup components or the raw cost value.
  const html = renderToStaticMarkup(
    <KpiCards visibleKpis={["spend", "cpc", "cpm"]} values={values} />
  );
  assert.ok(!html.includes("حداقل"));
  assert.ok(!html.includes("٪"));
  // Raw spend (100) is hidden; only the customer value (110) is shown.
  assert.ok(html.includes("۱۱۰"));
});

test("client pricing: existing KPI visibility configuration still works", () => {
  const raw = rawValues();
  const values = mergePricedValues(raw, pricedLayerFor(raw, {}));

  const html = renderToStaticMarkup(
    <KpiCards visibleKpis={["spend", "ctr"]} values={values} />
  );

  // Only configured KPIs render; others stay hidden.
  assert.ok(html.includes("هزینه تبلیغات"));
  assert.ok(html.includes("نرخ کلیک (CTR)"));
  assert.ok(!html.includes("نمایش‌ها"));
  assert.ok(!html.includes("کلیک‌ها"));
  assert.ok(!html.includes("هزینه به ازای کلیک (CPC)"));
});