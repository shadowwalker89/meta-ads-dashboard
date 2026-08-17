import type { DashboardKpiKey } from "@repo/shared";
import { KPI_CATALOG_BY_KEY } from "@repo/shared";
import { StatCard } from "@/components/dashboard/stat-card";
import { formatKpiValue } from "@/lib/kpi-format";
import { KPI_ICONS } from "@/lib/kpi-icons";

/**
 * Renders one KPI card. `change` is the percentage change vs the
 * previous period (null = comparison unavailable/untrustworthy → "—").
 * Direction and color follow StatCard's existing up/down convention.
 */
export function KpiCard({
  kpiKey,
  value,
  change,
}: {
  kpiKey: DashboardKpiKey;
  value: number;
  change?: number | null;
}) {
  const definition = KPI_CATALOG_BY_KEY.get(kpiKey);
  if (!definition) return null;

  const Icon = KPI_ICONS[kpiKey];

  const trend =
    change === undefined || change === null
      ? undefined
      : {
          value: Math.abs(Math.round(change * 10) / 10),
          direction: change >= 0 ? ("up" as const) : ("down" as const),
          label: "نسبت به دوره قبل",
        };

  return (
    <StatCard
      title={definition.label}
      value={formatKpiValue(kpiKey, value)}
      description={definition.description}
      trend={trend}
      trendNa={change === null}
      icon={<Icon />}
    />
  );
}