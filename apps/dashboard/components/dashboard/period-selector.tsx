import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  REPORTING_PERIODS,
  type ReportingPeriod,
} from "@/lib/dashboard-period";
import {
  DASHBOARD_STRINGS,
  periodLabel,
  type AppLanguage,
} from "@/lib/i18n/strings";

/**
 * Server-side reporting-period selector (7/30/90 days). Pure links with
 * the whitelisted period already validated by the page — this component
 * never reads or trusts query input itself. Uses the existing dashboard
 * design tokens (segmented control look, same as the rest of the UI).
 */
export function PeriodSelector({
  current,
  lang = "fa",
}: {
  current: ReportingPeriod;
  lang?: AppLanguage;
}) {
  const t = DASHBOARD_STRINGS[lang];
  return (
    <div
      role="tablist"
      aria-label={t.periodAriaLabel}
      className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1"
    >
      {REPORTING_PERIODS.map((period) => {
        const active = period === current;
        return (
          <Link
            key={period}
            role="tab"
            aria-selected={active}
            href={`/dashboard?range=${period}`}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {periodLabel(period, lang)}
          </Link>
        );
      })}
    </div>
  );
}