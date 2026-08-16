import { requirePageAccess, requireClientAccess } from "@/lib/access";
import { getClientPricingView } from "@/lib/client-pricing-view";
import { getClientKpiConfiguration } from "@/lib/kpi-config";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { CampaignPerformanceTable } from "@/components/dashboard/campaign-performance-table";
import type { DashboardKpiKey } from "@repo/shared";

export default async function DashboardPage() {
  const user = await requirePageAccess();
  const clientId = user.clientId ?? null;

  // Even though clientId is derived from the authenticated user (never
  // from request input), it is still routed through the boundary so the
  // client-scoping rule lives in exactly one place.
  if (clientId) {
    await requireClientAccess(user, clientId);
  }

  const kpis = clientId
    ? await getClientPricingView(clientId)
    : { values: {} as Record<DashboardKpiKey, number>, campaignCount: 0, campaigns: [] };
  const visibleKpis = clientId ? await getClientKpiConfiguration(clientId) : [];

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

      {visibleKpis.length > 0 ? (
        <KpiCards visibleKpis={visibleKpis} values={kpis.values} />
      ) : (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground">
          {clientId
            ? "هیچ شاخصی برای این مشتری فعال نیست."
            : "برای مشاهده‌ی شاخص‌ها، وارد حساب مشتری شوید."}
        </div>
      )}

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">عملکرد کمپین‌ها</h2>
          <p className="text-xs text-muted-foreground">
            جزئیات عملکرد هر کمپین بر اساس آخرین داده‌ی جمع‌آوری‌شده
          </p>
        </div>
        <CampaignPerformanceTable campaigns={kpis.campaigns} visibleKpis={visibleKpis} />
      </section>
    </div>
  );
}