import type { DashboardKpiKey } from "@repo/shared";
import { KPI_CATALOG_BY_KEY } from "@repo/shared";
import type { ClientCampaignKpi } from "@/lib/client-kpis";
import { formatKpiValue } from "@/lib/kpi-format";

const dateTimeFormatter = new Intl.DateTimeFormat("fa-IR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function CampaignPerformanceTable({
  campaigns,
  visibleKpis,
}: {
  campaigns: ClientCampaignKpi[];
  visibleKpis: DashboardKpiKey[];
}) {
  if (campaigns.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground">
        هنوز داده‌ای برای کمپین‌ها ثبت نشده است.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium text-right">نام کمپین</th>
            <th className="px-3 py-2 font-medium text-right">اکانت تبلیغاتی</th>
            {visibleKpis.map((kpiKey) => (
              <th key={kpiKey} className="px-3 py-2 font-medium text-right">
                {KPI_CATALOG_BY_KEY.get(kpiKey)?.label ?? kpiKey}
              </th>
            ))}
            <th className="px-3 py-2 font-medium text-right">زمان جمع‌آوری</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => (
            <tr
              key={campaign.campaignId}
              className="border-b border-border last:border-b-0"
            >
              <td className="px-3 py-2 font-medium">{campaign.campaignName}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {campaign.adAccountName}
              </td>
              {visibleKpis.map((kpiKey) => (
                <td
                  key={kpiKey}
                  className="px-3 py-2 tabular-nums whitespace-nowrap"
                >
                  {formatKpiValue(kpiKey, campaign.values[kpiKey] ?? 0)}
                </td>
              ))}
              <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                {dateTimeFormatter.format(campaign.capturedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}