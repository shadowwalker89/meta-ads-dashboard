import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import type { DashboardKpiKey } from "@repo/shared";
import { DEFAULT_VISIBLE_KPIS } from "@repo/shared";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { PeriodSelector } from "@/components/dashboard/period-selector";
import { CampaignPerformanceTable } from "@/components/dashboard/campaign-performance-table";

function emptyValues(keys: DashboardKpiKey[]): Record<DashboardKpiKey, number> {
  const values = {} as Record<DashboardKpiKey, number>;
  for (const key of keys) values[key] = 0;
  return values;
}

test("dashboard renders only the configured KPI cards", () => {
  const visible = ["spend", "ctr"] as DashboardKpiKey[];
  const html = renderToStaticMarkup(
    <KpiCards visibleKpis={visible} values={emptyValues(visible)} />
  );

  // Configured KPI labels are rendered...
  assert.ok(html.includes("هزینه تبلیغات"));
  assert.ok(html.includes("نرخ کلیک (CTR)"));
  // ...and KPIs that were NOT configured are absent.
  assert.ok(!html.includes("نمایش‌ها"));
  assert.ok(!html.includes("کلیک روی لینک"));
});

test("dashboard renders the default KPI set by default", () => {
  const visible = [...DEFAULT_VISIBLE_KPIS] as DashboardKpiKey[];
  const html = renderToStaticMarkup(
    <KpiCards visibleKpis={visible} values={emptyValues(visible)} />
  );

  for (const key of DEFAULT_VISIBLE_KPIS) {
    // Every default key's label must appear; "هزینه تبلیغات" is spend's label.
    assert.ok(html.includes("هزینه تبلیغات"), `missing spend card`);
    assert.ok(html.includes("نمایش‌ها"), `missing impressions card`);
    assert.ok(html.includes("کلیک‌ها"), `missing clicks card`);
    assert.ok(html.includes("کلیک روی لینک"), `missing linkClicks card`);
    assert.ok(html.includes("نرخ کلیک (CTR)"), `missing ctr card`);
    assert.ok(html.includes("هزینه به ازای کلیک (CPC)"), `missing cpc card`);
    assert.ok(html.includes("هزینه به ازای هزار نمایش (CPM)"), `missing cpm card`);
    break;
  }
});

test("campaign table renders only the configured KPI columns", () => {
  const visible = ["spend", "ctr"] as DashboardKpiKey[];
  const campaigns = [
    {
      campaignId: "c1",
      campaignName: "Campaign One",
      adAccountId: "a1",
      adAccountName: "Main Account",
      capturedAt: new Date("2026-01-01T00:00:00.000Z"),
      values: emptyValues(visible),
    },
  ];

  const html = renderToStaticMarkup(
    <CampaignPerformanceTable campaigns={campaigns} visibleKpis={visible} />
  );

  // Identity columns are always present.
  assert.ok(html.includes("نام کمپین"));
  assert.ok(html.includes("اکانت تبلیغاتی"));
  assert.ok(html.includes("Campaign One"));
  assert.ok(html.includes("Main Account"));

  // Only configured metric columns render.
  assert.ok(html.includes("هزینه تبلیغات"));
  assert.ok(html.includes("نرخ کلیک (CTR)"));
  assert.ok(!html.includes("نمایش‌ها"));
  assert.ok(!html.includes("کلیک روی لینک"));
  assert.ok(!html.includes("هزینه به ازای کلیک (CPC)"));
});

test("period selector renders the 7/30/90 whitelist and marks the active period", () => {
  const html = renderToStaticMarkup(<PeriodSelector current={30} />);

  assert.ok(html.includes("/dashboard?range=7"));
  assert.ok(html.includes("/dashboard?range=30"));
  assert.ok(html.includes("/dashboard?range=90"));
  assert.ok(html.includes("۷ روز"));
  assert.ok(html.includes("۳۰ روز"));
  assert.ok(html.includes("۹۰ روز"));

  // Exactly one tab is active: the current period.
  const activeCount = html.split('aria-selected="true"').length - 1;
  assert.equal(activeCount, 1);
});

test("kpi cards render positive, negative, and unavailable period changes", () => {
  const values = emptyValues(["spend", "impressions"]);

  const positive = renderToStaticMarkup(
    <KpiCards
      visibleKpis={["spend"]}
      values={values}
      changes={{ spend: 15 } as Record<DashboardKpiKey, number | null>}
    />
  );
  assert.ok(positive.includes("▲"));
  assert.ok(positive.includes("15%"));
  assert.ok(positive.includes("نسبت به دوره قبل"));

  const negative = renderToStaticMarkup(
    <KpiCards
      visibleKpis={["spend"]}
      values={values}
      changes={{ spend: -12.34 } as Record<DashboardKpiKey, number | null>}
    />
  );
  assert.ok(negative.includes("▼"));
  assert.ok(negative.includes("12.3%"));

  // null → comparison unavailable/untrustworthy → "—", never a trend arrow.
  const na = renderToStaticMarkup(
    <KpiCards
      visibleKpis={["spend", "impressions"]}
      values={values}
      changes={{ spend: null } as Record<DashboardKpiKey, number | null>}
    />
  );
  assert.ok(na.includes("—"));
  assert.ok(!na.includes("▲"));
});