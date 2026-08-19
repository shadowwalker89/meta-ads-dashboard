import {
  Building2,
  CalendarRange,
  Clock,
  Landmark,
  Layers,
  Megaphone,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { requirePageAccess } from "@/lib/access";
import { getAdminOverviewData } from "@/lib/admin-overview";
import { getDashboardLanguage } from "@/lib/i18n/language";
import { DASHBOARD_STRINGS } from "@/lib/i18n/strings";
import { formatDateTime, formatRange } from "@/lib/i18n/format";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSummaryStrip } from "@/components/admin/admin-summary-strip";
import { AdminClientSelect } from "@/components/admin/admin-client-select";
import { AdminKpiCards } from "@/components/admin/admin-kpi-cards";

interface AdminOverviewPageProps {
  searchParams: Promise<{ clientId?: string }>;
}

/**
 * Admin Overview (/admin) — the operational management home.
 *
 * Reads only existing services (getAdminOverviewData composes
 * getClientAdminData + getClientDashboardData + the KPI configuration
 * resolver through the central access boundary). The clientId arrives
 * from request input and is validated against the admin's accessible
 * clients before any data is read — never trusted raw.
 */
export default async function AdminOverviewPage({
  searchParams,
}: AdminOverviewPageProps) {
  const user = await requirePageAccess("admin", "super_admin");
  const lang = await getDashboardLanguage();
  const t = DASHBOARD_STRINGS[lang];

  const { clientId } = await searchParams;
  const requestedClientId =
    typeof clientId === "string" && clientId.length > 0 ? clientId : null;

  const data = await getAdminOverviewData(user, requestedClientId);

  const lastCapturedAt =
    data.dashboard && data.dashboard.campaigns.length > 0
      ? data.dashboard.campaigns.reduce(
          (latest, campaign) =>
            campaign.capturedAt > latest ? campaign.capturedAt : latest,
          data.dashboard.campaigns[0].capturedAt
        )
      : null;

  const summaryItems = [
    { label: t.adminSummaryClients, value: String(data.clients.length), icon: UserRound },
    { label: t.adminSummaryAdAccounts, value: String(data.totalAdAccounts), icon: Landmark },
    { label: t.adminSummaryPackages, value: String(data.packageCount), icon: Layers },
    {
      label: t.adminSummaryCampaigns,
      value: data.selectedClient ? String(data.dashboard?.campaignCount ?? 0) : "—",
      icon: Megaphone,
    },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <AdminPageHeader
          title={t.adminOverviewTitle}
          subtitle={t.adminOverviewSubtitle}
          meta={
            <AdminClientSelect
              clients={data.clients}
              selectedClientId={data.selectedClient?.id ?? null}
              baseHref="/admin"
            />
          }
        />

        {data.selectedClient && data.dashboard ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/60 pt-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="size-3.5" aria-hidden="true" />
              <span className="font-medium text-foreground">
                {data.selectedClient.name}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarRange className="size-3.5" aria-hidden="true" />
              {formatRange(lang, data.dashboard.period.range)}
            </span>
            {lastCapturedAt ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-3.5" aria-hidden="true" />
                {t.lastUpdate} {formatDateTime(lang, lastCapturedAt)}
              </span>
            ) : null}
          </div>
        ) : null}
      </section>

      <AdminSummaryStrip items={summaryItems} />

      {data.selectedClient ? (
        data.dashboard && data.visibleKpis.length > 0 ? (
          <AdminKpiCards
            kpis={data.visibleKpis.map((key) => ({
              key,
              value: data.dashboard?.values[key] ?? 0,
              change: data.dashboard?.period.change[key],
            }))}
          />
        ) : (
          <div className="flex h-32 flex-col items-center justify-center gap-1 rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground">
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            {t.adminNoData}
          </div>
        )
      ) : (
        <div className="flex h-40 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed bg-muted/40 px-4 text-center">
          <UserRound className="size-5 text-muted-foreground/60" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">
            {t.adminNoClientSelected}
          </p>
          <p className="text-xs text-muted-foreground">
            {t.adminNoClientSelectedHint}
          </p>
        </div>
      )}
    </div>
  );
}