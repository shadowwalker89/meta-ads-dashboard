import type { DashboardKpiKey } from "@repo/shared";
import { KpiCard } from "@/components/dashboard/kpi-card";
import type { AppLanguage } from "@/lib/i18n/strings";

/**
 * Renders one StatCard per configured KPI key. The caller decides the
 * configured keys (via the shared catalog + client preference); this
 * component only renders exactly those — nothing is hardcoded here.
 */
export function KpiCards({
  visibleKpis,
  values,
  changes,
  lang = "fa",
}: {
  visibleKpis: DashboardKpiKey[];
  values: Record<DashboardKpiKey, number>;
  changes?: Record<DashboardKpiKey, number | null>;
  lang?: AppLanguage;
}) {
  return (
    <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4">
      {visibleKpis.map((kpiKey) => (
        <KpiCard
          key={kpiKey}
          kpiKey={kpiKey}
          value={values[kpiKey]}
          change={changes?.[kpiKey]}
          lang={lang}
        />
      ))}
    </div>
  );
}