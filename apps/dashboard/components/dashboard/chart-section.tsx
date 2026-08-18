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
import { useDashboardLang } from "@/components/layout/language-provider";
import { periodLabel, tpl } from "@/lib/i18n/strings";

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
  const { lang, strings: t } = useDashboardLang();
  const [selectedMetric, setSelectedMetric] = useState<DashboardKpiKey>(
    availableMetrics[0] ?? CHART_METRICS[0]
  );

  const rows = buildCampaignChartRows(campaigns, selectedMetric);
  const maxValue = rows.length > 0 ? rows[0].value : 0;
  const totalValue = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <section
      data-slot="chart-section"
      className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-sm font-semibold">{t.chartTitle}</h2>
          <p className="text-[0.7rem] leading-4 text-muted-foreground">
            {tpl(t.chartDescription, { period: periodLabel(period, lang) })}
          </p>
        </div>

        {rows.length > 0 ? (
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <span className="text-[0.68rem] text-muted-foreground">
              {tpl(t.chartTotalLabel, {
                metric: getChartMetricLabel(selectedMetric, lang),
              })}
            </span>
            <span className="text-base font-semibold tracking-tight tabular-nums">
              {formatKpiValue(selectedMetric, totalValue, lang)}
            </span>
          </div>
        ) : null}
      </div>

      {availableMetrics.length > 0 ? (
        <div
          role="tablist"
          aria-label={t.chartMetricAria}
          className="inline-flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-border bg-muted/40 p-1"
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
                  "shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {getChartMetricLabel(metric, lang)}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex h-28 items-center justify-center rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground">
          {t.chartNoMetric}
        </div>
      )}

      {availableMetrics.length > 0 ? (
        campaigns.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground">
            {t.chartNoData}
          </div>
        ) : (
          <div
            data-slot="chart-bars"
            className="flex min-w-0 max-h-80 flex-col gap-2 overflow-y-auto ps-1 pe-1"
            aria-label={tpl(t.chartBarsAriaLabel, {
              metric: getChartMetricLabel(selectedMetric, lang),
            })}
          >
            {rows.map((row, index) => (
              <div
                key={row.label}
                className="flex items-center gap-2.5 text-sm"
              >
                <span className="w-5 shrink-0 text-[0.68rem] tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
                <span
                  className="w-28 shrink-0 truncate text-[0.8rem] text-muted-foreground"
                  title={row.label}
                >
                  {row.label}
                </span>
                <div className="h-4 min-w-0 flex-1 overflow-hidden rounded-md bg-muted/50">
                  <div
                    className="h-full rounded-md bg-primary/90"
                    style={{ width: `${barWidthPercent(row.value, maxValue)}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-end text-[0.8rem] font-semibold tabular-nums">
                  {formatKpiValue(selectedMetric, row.value, lang)}
                </span>
              </div>
            ))}
          </div>
        )
      ) : null}
    </section>
  );
}