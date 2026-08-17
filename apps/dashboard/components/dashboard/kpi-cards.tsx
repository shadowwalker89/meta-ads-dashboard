import type { DashboardKpiKey } from "@repo/shared";
import { KpiCard } from "@/components/dashboard/kpi-card";

/**
 * Renders one StatCard per configured KPI key. The caller decides the
 * configured keys (via the shared catalog + client preference); this
 * component only renders exactly those — nothing is hardcoded here.
 */
export function KpiCards({
  visibleKpis,
  values,
  changes,
}: {
  visibleKpis: DashboardKpiKey[];
  values: Record<DashboardKpiKey, number>;
  changes?: Record<DashboardKpiKey, number | null>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {visibleKpis.map((kpiKey) => (
        <KpiCard
          key={kpiKey}
          kpiKey={kpiKey}
          value={values[kpiKey]}
          change={changes?.[kpiKey]}
        />
      ))}
    </div>
  );
}