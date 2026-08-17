import { requirePageAccess } from "@/lib/access";
import { getClientDashboardData } from "@/lib/client-dashboard-data";
import { getClientKpiConfiguration } from "@/lib/kpi-config";
import {
  DEFAULT_REPORTING_PERIOD,
  isReportingPeriod,
  reportingRangeForDays,
  type ReportingPeriod,
} from "@/lib/dashboard-period";
import { AccessError } from "@/lib/access";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { PeriodSelector } from "@/components/dashboard/period-selector";
import { CampaignPerformanceTable } from "@/components/dashboard/campaign-performance-table";
import { ChartSection } from "@/components/dashboard/chart-section";
import { AdvancedReportingSection } from "@/components/dashboard/advanced-reporting-section";
import { DataExportButton } from "@/components/dashboard/data-export-button";
import { getClientPackageFeatures } from "@/lib/package-features";
import { resolveChartableMetrics } from "@/lib/campaign-chart";

const periodLabelFormatter = new Intl.NumberFormat("fa-IR");

function resolveReportingPeriod(value: unknown): ReportingPeriod {
  return isReportingPeriod(value) ? value : DEFAULT_REPORTING_PERIOD;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await requirePageAccess();
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">داشبورد</h1>
        <p className="text-sm text-muted-foreground">
          نمای کلی عملکرد کمپین‌های تبلیغاتی
        </p>
        <p className="text-xs text-muted-foreground">
          {user.fullName} ({user.email})
        </p>
      </div>

      {clientId ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">بازه‌ی گزارش‌گیری</span>
          <div className="flex items-center gap-2">
            {features?.dataExport ? <DataExportButton period={period} /> : null}
            <PeriodSelector current={period} />
          </div>
        </div>
      ) : null}

      {loadError ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-destructive/40 bg-destructive/5 text-sm text-destructive">
          خطا در بارگذاری داده‌ها. دوباره تلاش کنید.
        </div>
      ) : data === null ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground">
          برای مشاهده‌ی شاخص‌ها، وارد حساب مشتری شوید.
        </div>
      ) : visibleKpis.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground">
          هیچ شاخصی برای این مشتری فعال نیست.
        </div>
      ) : data.snapshotCount === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground">
          هنوز داده‌ای برای این بازه ثبت نشده است.
        </div>
      ) : (
        <KpiCards
          visibleKpis={visibleKpis}
          values={data.values}
          changes={data.period.change}
        />
      )}

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">عملکرد کمپین‌ها</h2>
          <p className="text-xs text-muted-foreground">
            جزئیات عملکرد هر کمپین بر اساس آخرین داده‌ی جمع‌آوری‌شده در بازه‌ی{" "}
            {periodLabelFormatter.format(period)} روز اخیر
          </p>
        </div>
        <CampaignPerformanceTable
          campaigns={data?.campaigns ?? []}
          visibleKpis={visibleKpis}
        />
      </section>

      {features?.charts ? (
        <ChartSection
          campaigns={data?.campaigns ?? []}
          availableMetrics={chartMetrics}
          period={period}
        />
      ) : null}
      {features?.advancedReporting ? <AdvancedReportingSection /> : null}
    </div>
  );
}