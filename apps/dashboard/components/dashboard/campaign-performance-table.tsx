import type { DashboardKpiKey } from "@repo/shared";
import type { ClientCampaignKpi } from "@/lib/client-kpis";
import { formatKpiValue } from "@/lib/kpi-format";
import {
  getKpiLabel,
  DASHBOARD_STRINGS,
  localeForLanguage,
  type AppLanguage,
} from "@/lib/i18n/strings";

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

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

/**
 * Campaign performance table. The table uses its natural column widths
 * and lets long campaign names wrap, so it fits the available card width
 * on desktop. On narrow screens the wrapper scrolls HORIZONTALLY ONLY —
 * the overflow is local to this table, never the page. Alignment uses
 * logical utilities (text-start) so RTL/LTR both read correctly.
 */
export function CampaignPerformanceTable({
  campaigns,
  visibleKpis,
  lang = "fa",
}: {
  campaigns: ClientCampaignKpi[];
  visibleKpis: DashboardKpiKey[];
  lang?: AppLanguage;
}) {
  const t = DASHBOARD_STRINGS[lang];

  if (campaigns.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground">
        {t.tableEmpty}
      </div>
    );
  }

  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="sticky top-0 bg-card px-3 py-2 font-medium text-start">
              {t.tableCampaignName}
            </th>
            <th className="sticky top-0 bg-card px-3 py-2 font-medium text-start">
              {t.tableAdAccount}
            </th>
            {visibleKpis.map((kpiKey) => (
              <th
                key={kpiKey}
                className="sticky top-0 bg-card px-3 py-2 font-medium text-start whitespace-nowrap"
              >
                {getKpiLabel(kpiKey, lang)}
              </th>
            ))}
            <th className="sticky top-0 bg-card px-3 py-2 font-medium text-start whitespace-nowrap">
              {t.tableCapturedAt}
            </th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => (
            <tr
              key={campaign.campaignId}
              className="border-b border-border transition-colors last:border-b-0 hover:bg-muted/40"
            >
              <td className="min-w-36 max-w-64 px-3 py-2 font-medium text-[0.82rem]">
                {campaign.campaignName}
              </td>
              <td className="min-w-36 max-w-56 px-3 py-2 text-[0.8rem] text-muted-foreground">
                {campaign.adAccountName}
              </td>
              {visibleKpis.map((kpiKey) => (
                <td
                  key={kpiKey}
                  className="px-3 py-2 text-[0.8rem] tabular-nums whitespace-nowrap"
                >
                  {formatKpiValue(kpiKey, campaign.values[kpiKey] ?? 0, lang)}
                </td>
              ))}
              <td className="px-3 py-2 text-[0.8rem] text-muted-foreground tabular-nums whitespace-nowrap">
                {dateTimeFormatterFor(lang).format(campaign.capturedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}