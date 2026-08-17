"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { DashboardKpiKey } from "@repo/shared";
import type { ClientCampaignKpi } from "@/lib/client-kpis";
import type { ReportingPeriod } from "@/lib/dashboard-period";
import { formatKpiValue } from "@/lib/kpi-format";
import {
  CHART_METRICS,
  buildCampaignChartRows,
  getChartMetricLabel,
  barWidthPercent,
} from "@/lib/campaign-chart";

const PERIOD_LABELS: Record<ReportingPeriod, string> = {
  7: "۷ روز",
  30: "۳۰ روز",
  90: "۹۰ روز",
};

/**
 * Campaign-comparison chart, gated behind the package `charts` feature
 * flag by the dashboard page.
 *
 * This is an honest comparison chart, NOT a time-series: each bar is a
 * campaign's LATEST cumulative reading inside the selected reporting
 * window. Values are the customer-facing (priced) numbers the dashboard
 * already displays — this component receives them as props from the
 * authorized dashboard read; it never fetches, never re-prices, and
 * never fabricates daily activity from cumulative/as-of values.
 *
 * Data contract: `campaigns` and `availableMetrics` are resolved
 * server-side (visible KPIs ∩ supported chart metrics); the client only
 * picks which of the granted metrics to display and renders bars.
 */
export function ChartSection({
  campaigns,
  availableMetrics,
  period,
}: {
  campaigns: ClientCampaignKpi[];
  availableMetrics: DashboardKpiKey[];
  period: ReportingPeriod;
}) {
  const [selectedMetric, setSelectedMetric] = useState<DashboardKpiKey>(
    availableMetrics[0] ?? CHART_METRICS[0]
  );

  const rows = buildCampaignChartRows(campaigns, selectedMetric);
  const maxValue = rows.length > 0 ? rows[0].value : 0;

  return (
    <section
      data-slot="chart-section"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">مقایسه‌ی کمپین‌ها</h2>
        <p className="text-xs text-muted-foreground">
          ارزش‌های دوره‌ی جاری بر اساس آخرین داده‌ی جمع‌آوری‌شده در{" "}
          {PERIOD_LABELS[period]} اخیر — مقادیر تجمعی دوره، نه فعالیت روزانه.
        </p>
      </div>

      {availableMetrics.length > 0 ? (
        <div
          role="tablist"
          aria-label="معیار نمودار"
          className="inline-flex w-fit items-center gap-1 rounded-lg border border-border bg-muted/40 p-1"
        >
          {availableMetrics.map((metric) => {
            const active = metric === selectedMetric;
            return (
              <button
                key={metric}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedMetric(metric)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {getChartMetricLabel(metric)}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground">
          هیچ معیار نموداری برای این مشتری فعال نیست.
        </div>
      )}

      {availableMetrics.length > 0 ? (
        campaigns.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground">
            هنوز داده‌ای برای این بازه ثبت نشده است.
          </div>
        ) : (
          <div
            data-slot="chart-bars"
            className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1"
            aria-label={`مقایسه‌ی کمپین‌ها — ${getChartMetricLabel(selectedMetric)}`}
          >
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex items-center gap-3 text-sm"
              >
                <span
                  className="w-32 shrink-0 truncate text-muted-foreground"
                  title={row.label}
                >
                  {row.label}
                </span>
                <div className="h-5 flex-1 overflow-hidden rounded-md bg-muted/50">
                  <div
                    className="h-full rounded-md bg-primary/80"
                    style={{ width: `${barWidthPercent(row.value, maxValue)}%` }}
                  />
                </div>
                <span className="w-20 shrink-0 text-left tabular-nums">
                  {formatKpiValue(selectedMetric, row.value)}
                </span>
              </div>
            ))}
          </div>
        )
      ) : null}
    </section>
  );
}