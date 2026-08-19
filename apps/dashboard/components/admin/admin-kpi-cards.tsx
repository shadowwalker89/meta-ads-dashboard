"use client";

import { ArrowDownRight, ArrowUpRight, Info } from "lucide-react";
import type { DashboardKpiKey } from "@repo/shared";
import { cn } from "@/lib/utils";
import { formatKpiValue } from "@/lib/kpi-format";
import { useDashboardLang } from "@/components/layout/language-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  getAdminKpiDescription,
  getAdminKpiTitle,
  tpl,
} from "@/lib/i18n/strings";

/**
 * One compact Admin KPI card.
 *
 * Deliberately different from the client-facing KPI card:
 *   - The KPI title is the official ENGLISH name in both fa and en
 *     (product decision — the Admin panel is not a translated copy of
 *     the client dashboard).
 *   - A small help button in the corner shows the short PERSIAN
 *     explanation from the shared KPI catalog (single source of truth)
 *     via an accessible Radix tooltip that works with hover, keyboard
 *     focus and touch tap/focus.
 *   - Compact, dense footprint for management workflows.
 */
function AdminKpiCard({
  kpiKey,
  value,
  change,
}: {
  kpiKey: DashboardKpiKey;
  value: number;
  change?: number | null;
}) {
  const { lang, strings: t } = useDashboardLang();
  const title = getAdminKpiTitle(kpiKey);
  const description = getAdminKpiDescription(kpiKey);

  const hasTrend = change !== null && change !== undefined;
  const trend = hasTrend
    ? {
        value: Math.abs(Math.round(change * 10) / 10),
        direction: change >= 0 ? ("up" as const) : ("down" as const),
      }
    : null;

  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <span
          dir="ltr"
          className="truncate text-[0.72rem] font-medium leading-4 text-muted-foreground"
        >
          {title}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={tpl(t.adminKpiHelp, { kpi: title })}
              title={tpl(t.adminKpiHelp, { kpi: title })}
              className="-me-1 -mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Info className="size-3.5" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" align="end">
            <span lang="fa">{description}</span>
          </TooltipContent>
        </Tooltip>
      </div>

      <span className="truncate text-lg font-semibold tracking-tight text-foreground tabular-nums">
        {formatKpiValue(kpiKey, value, lang)}
      </span>

      {trend ? (
        <span
          data-slot="admin-kpi-trend"
          data-direction={trend.direction}
          className={cn(
            "inline-flex w-fit items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.68rem] font-semibold",
            trend.direction === "up"
              ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400"
              : "bg-destructive/10 text-destructive"
          )}
        >
          {trend.direction === "up" ? (
            <ArrowUpRight className="size-3" aria-hidden="true" />
          ) : (
            <ArrowDownRight className="size-3" aria-hidden="true" />
          )}
          {trend.value}%
          <span className="font-medium text-muted-foreground">
            · {t.trendVsPrevious}
          </span>
        </span>
      ) : (
        <span className="text-[0.68rem] text-muted-foreground">—</span>
      )}
    </div>
  );
}

/**
 * Compact grid of Admin KPI cards. One provider wraps the grid so every
 * help tooltip shares a single Radix TooltipProvider.
 */
export function AdminKpiCards({
  kpis,
}: {
  kpis: { key: DashboardKpiKey; value: number; change?: number | null }[];
}) {
  return (
    <TooltipProvider>
      <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-4">
        {kpis.map(({ key, value, change }) => (
          <AdminKpiCard
            key={key}
            kpiKey={key}
            value={value}
            change={change}
          />
        ))}
      </div>
    </TooltipProvider>
  );
}