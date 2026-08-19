"use client";

import type { ClientPricingVerification } from "@/lib/pricing-admin";
import type { PricedKpi } from "@/lib/pricing";
import type { PricingRule } from "@repo/shared";
import { PRICABLE_METRICS } from "@repo/shared";
import { formatKpiValue } from "@/lib/kpi-format";
import { useDashboardLang } from "@/components/layout/language-provider";
import {
  getAdminKpiTitle,
  tpl,
  type AppLanguage,
  type DashboardStrings,
} from "@/lib/i18n/strings";
import {
  formatRuleComponents,
  formatRuleEffectiveDate,
} from "@/lib/pricing-format";

function RuleDisplay({
  rule,
  strings: t,
}: {
  rule: PricingRule;
  strings: DashboardStrings;
}) {
  const components = formatRuleComponents(rule);

  return (
    <div className="flex flex-col gap-1">
      <span className="font-medium text-foreground">{t.pricingRule}</span>
      <div className="flex flex-wrap gap-1.5">
        {components.map((component, index) => (
          <span
            key={index}
            className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary tabular-nums"
          >
            {component}
          </span>
        ))}
      </div>
      <span className="text-xs text-muted-foreground">
        {tpl(t.pricingEffectiveFrom, { date: formatRuleEffectiveDate(rule.effectiveFrom) })}
      </span>
    </div>
  );
}

function PricedRow({
  entry,
  lang,
  strings: t,
}: {
  entry: PricedKpi;
  lang: AppLanguage;
  strings: DashboardStrings;
}) {
  const hasRule = entry.rule !== null;
  const differs = entry.customerValue !== entry.rawValue;

  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-3 py-3">
        <span className="font-medium">{getAdminKpiTitle(entry.metric)}</span>
      </td>

      <td className="px-3 py-3">
        <span className="tabular-nums text-muted-foreground">
          {formatKpiValue(entry.metric, entry.rawValue, lang)}
        </span>
      </td>

      <td className="px-3 py-3">
        {hasRule && entry.rule ? (
          <RuleDisplay rule={entry.rule} strings={t} />
        ) : (
          <span className="text-sm text-muted-foreground">{t.pricingNoRule}</span>
        )}
      </td>

      <td className="px-3 py-3">
        <div className="flex flex-col items-start gap-1">
          <span
            className={`text-base font-semibold tabular-nums ${
              differs ? "text-primary" : "text-foreground"
            }`}
          >
            {formatKpiValue(entry.metric, entry.customerValue, lang)}
          </span>
          {hasRule && differs && (
            <span className="rounded-md bg-emerald-600/10 px-1.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              {t.pricingApplied}
            </span>
          )}
          {!hasRule && (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {t.pricingUnchanged}
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

export function PricingVerificationTable({
  verification,
}: {
  verification: ClientPricingVerification;
}) {
  const { lang, strings: t } = useDashboardLang();

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{t.pricingClientTitle}</h2>
        <p className="text-xs text-muted-foreground">
          {verification.clientName} — {verification.clientId}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium text-right">{t.pricingMetric}</th>
              <th className="px-3 py-2 font-medium text-right">{t.pricingRawValue}</th>
              <th className="px-3 py-2 font-medium text-right">{t.pricingRule}</th>
              <th className="px-3 py-2 font-medium text-right">{t.pricingCustomerValue}</th>
            </tr>
          </thead>
          <tbody>
            {PRICABLE_METRICS.map((metric) => {
              const entry = verification.priced.find((p) => p.metric === metric);
              if (!entry) return null;
              return <PricedRow key={metric} entry={entry} lang={lang} strings={t} />;
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}