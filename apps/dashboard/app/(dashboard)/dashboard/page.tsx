import {
  AlertTriangle,
  CalendarRange,
  Clock,
  Inbox,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { requirePageAccess } from "@/lib/access";
import { getClientDashboardData } from "@/lib/client-dashboard-data";
import { getClientKpiConfiguration } from "@/lib/kpi-config";
import {
  DEFAULT_REPORTING_PERIOD,
  isReportingPeriod,
  reportingRangeForDays,
  type DashboardRange,
  type ReportingPeriod,
} from "@/lib/dashboard-period";
import { AccessError } from "@/lib/access";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { PeriodSelector } from "@/components/dashboard/period-selector";
import { CampaignPerformanceTable } from "@/components/dashboard/campaign-performance-table";
import { ChartSection } from "@/components/dashboard/chart-section";
import { AdvancedReportingSection } from "@/components/dashboard/advanced-reporting-section";
import { DataExportButton } from "@/components/dashboard/data-export-button";
import { DashboardEmptyState } from "@/components/dashboard/dashboard-empty-state";
import { getClientPackageFeatures } from "@/lib/package-features";
import { resolveChartableMetrics } from "@/lib/campaign-chart";
import { getDashboardLanguage } from "@/lib/i18n/language";
import {
  DASHBOARD_STRINGS,
  tpl,
  localeForLanguage,
  type AppLanguage,
} from "@/lib/i18n/strings";

const dateFormatters = new Map<string, Intl.DateTimeFormat>();
const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();
const numberFormatters = new Map<string, Intl.NumberFormat>();

function dateFormatterFor(lang: AppLanguage): Intl.DateTimeFormat {
  const locale = localeForLanguage(lang);
  let formatter = dateFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    dateFormatters.set(locale, formatter);
  }
  return formatter;
}

function dateTimeFormatterFor(lang: AppLanguage): Intl.DateTimeFormat {
  const locale = localeForLanguage(lang);
  let formatter = dateTimeFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    dateTimeFormatters.set(locale, formatter);
  }
  return formatter;
}

function numberFormatterFor(lang: AppLanguage): Intl.NumberFormat {
  const locale = localeForLanguage(lang);
  let formatter = numberFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale);
    numberFormatters.set(locale, formatter);
  }
  return formatter;
}

function resolveReportingPeriod(value: unknown): ReportingPeriod {
  return isReportingPeriod(value) ? value : DEFAULT_REPORTING_PERIOD;
}

function formatRange(range: DashboardRange, lang: AppLanguage): string {
  const formatter = dateFormatterFor(lang);
  return tpl(DASHBOARD_STRINGS[lang].rangeFromTo, {
    from: formatter.format(range.from),
    to: formatter.format(range.to),
  });
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await requirePageAccess();
  const lang = await getDashboardLanguage();
  const t = DASHBOARD_STRINGS[lang];
  const clientId = user.clientId ?? null;

  // `range` arrives from request input and is NEVER trusted: it is
  // validated against the 7/30/90 whitelist and falls back safely.
  const { range: rawRange } = await searchParams;
  const period = resolveReportingPeriod(rawRange);
  const range = reportingRangeForDays(period);

  // clientId is derived from the authenticated user (never from request
  // input); the read service re-verifies it through the access boundary
  // (requireClientAccess) regardless, so the scoping rule lives in one
  // place and is enforced even for future callers that pass raw input.
  let data:
    | Awaited<ReturnType<typeof getClientDashboardData>>
    | null = null;
  let loadError = false;
  if (clientId) {
    try {
      data = await getClientDashboardData(user, clientId, undefined, range);
    } catch (error) {
      if (error instanceof AccessError) throw error;
      loadError = true;
    }
  }

  const visibleKpis = clientId ? await getClientKpiConfiguration(clientId) : [];

  // Feature surfaces are resolved server-side from the authenticated
  // user's Package entitlements — never from request input. This call
  // re-verifies access through the same boundary (requireClientAccess)
  // used by the data read above, so an unauthorized caller cannot see
  // or enable any feature surface.
  const features = clientId ? await getClientPackageFeatures(user, clientId) : null;

  // Chart metrics are the supported comparison metrics the client is
  // actually allowed to see — never a superset of the resolved KPI
  // visibility. The chart surface itself is gated on the package
  // `charts` flag below.
  const chartMetrics = resolveChartableMetrics(visibleKpis);

  // Honest "as of" indicator: the most recent data collection time among
  // the campaigns shown in this window (null when there is no data).
  const lastCapturedAt =
    data && data.campaigns.length > 0
      ? data.campaigns.reduce(
          (latest, campaign) =>
            campaign.capturedAt > latest ? campaign.capturedAt : latest,
          data.campaigns[0].capturedAt
        )
      : null;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <section className="relative overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        {/* Subtle layered background: two blurred radial glows + a faint
            grid. Purely decorative — aria-hidden and pointer-events-none. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -end-20 size-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-28 -start-14 size-56 rounded-full bg-chart-2/10 blur-3xl" />
          <div className="hero-grid absolute inset-0 opacity-[0.05] dark:opacity-[0.07]" />
        </div>

        <div className="relative flex min-w-0 flex-col gap-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="text-xl font-semibold tracking-tight">
                {t.dashboardTitle}
              </h1>
              <p className="text-xs text-muted-foreground">
                {t.dashboardSubtitle}
              </p>
            </div>

            {clientId && data ? (
              <div className="flex shrink-0 flex-col items-start gap-1 text-xs text-muted-foreground md:items-end">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarRange className="size-3.5" aria-hidden="true" />
                  {formatRange(data.period.range, lang)}
                </span>
                {lastCapturedAt ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-3.5" aria-hidden="true" />
                    {t.lastUpdate}{" "}
                    {dateTimeFormatterFor(lang).format(lastCapturedAt)}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {clientId ? (
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border/60 pt-4">
              <span className="text-xs font-medium text-muted-foreground">
                {t.reportingRangeLabel}
              </span>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {features?.dataExport ? <DataExportButton period={period} /> : null}
                <PeriodSelector current={period} lang={lang} />
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {loadError ? (
        <DashboardEmptyState
          tone="destructive"
          icon={AlertTriangle}
          message={t.errorLoadingData}
          className="h-32"
        />
      ) : data === null ? (
        <DashboardEmptyState
          icon={UserRound}
          message={t.noClientAccount}
          className="h-32"
        />
      ) : visibleKpis.length === 0 ? (
        <DashboardEmptyState
          icon={SlidersHorizontal}
          message={t.noKpisActive}
          hint={t.noKpisActiveHint}
          className="h-32"
        />
      ) : data.snapshotCount === 0 ? (
        <DashboardEmptyState
          icon={Inbox}
          message={t.noDataRecorded}
          hint={t.noDataRecordedHint}
          className="h-32"
        />
      ) : (
        <KpiCards
          visibleKpis={visibleKpis}
          values={data.values}
          changes={data.period.change}
          lang={lang}
        />
      )}

      <section className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold">{t.campaignTableTitle}</h2>
          <p className="text-[0.7rem] leading-4 text-muted-foreground">
            {tpl(t.campaignTableDescription, {
              period: numberFormatterFor(lang).format(period),
            })}
          </p>
        </div>
        <CampaignPerformanceTable
          campaigns={data?.campaigns ?? []}
          visibleKpis={visibleKpis}
          lang={lang}
        />
      </section>

      {features?.charts ? (
        <ChartSection
          campaigns={data?.campaigns ?? []}
          availableMetrics={chartMetrics}
          period={period}
        />
      ) : null}
      {features?.advancedReporting ? (
        <AdvancedReportingSection lang={lang} />
      ) : null}
    </div>
  );
}