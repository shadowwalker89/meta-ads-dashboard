import type { DashboardKpiKey } from "@repo/shared";
import { StatCard } from "@/components/dashboard/stat-card";
import { formatKpiValue } from "@/lib/kpi-format";
import { KPI_ICONS } from "@/lib/kpi-icons";
import {
  getKpiDescription,
  getKpiLabel,
  DASHBOARD_STRINGS,
  type AppLanguage,
} from "@/lib/i18n/strings";

/**
 * Renders one KPI card. `change` is the percentage change vs the
 * previous period (null = comparison unavailable/untrustworthy → "—").
 * Direction and color follow StatCard's existing up/down convention.
 */
export function KpiCard({
  kpiKey,
  value,
  change,
  lang = "fa",
}: {
  kpiKey: DashboardKpiKey;
  value: number;
  change?: number | null;
  lang?: AppLanguage;
}) {
  const t = DASHBOARD_STRINGS[lang];
  const Icon = KPI_ICONS[kpiKey];

  const trend =
    change === undefined || change === null
      ? undefined
      : {
          value: Math.abs(Math.round(change * 10) / 10),
          direction: change >= 0 ? ("up" as const) : ("down" as const),
          label: t.trendVsPrevious,
        };

  return (
    <StatCard
      title={getKpiLabel(kpiKey, lang)}
      value={formatKpiValue(kpiKey, value, lang)}
      description={getKpiDescription(kpiKey, lang)}
      trend={trend}
      trendNa={change === null}
      icon={<Icon />}
    />
  );
}