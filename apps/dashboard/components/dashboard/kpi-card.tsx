import type { DashboardKpiKey } from "@repo/shared";
import { KPI_CATALOG_BY_KEY } from "@repo/shared";
import { StatCard } from "@/components/dashboard/stat-card";
import { formatKpiValue } from "@/lib/kpi-format";
import { KPI_ICONS } from "@/lib/kpi-icons";

export function KpiCard({
  kpiKey,
  value,
}: {
  kpiKey: DashboardKpiKey;
  value: number;
}) {
  const definition = KPI_CATALOG_BY_KEY.get(kpiKey);
  if (!definition) return null;

  const Icon = KPI_ICONS[kpiKey];

  return (
    <StatCard
      title={definition.label}
      value={formatKpiValue(kpiKey, value)}
      description={definition.description}
      icon={<Icon />}
    />
  );
}