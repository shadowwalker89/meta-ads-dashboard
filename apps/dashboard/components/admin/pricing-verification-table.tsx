import type { ClientPricingVerification } from "@/lib/pricing-admin";
import type { PricedKpi } from "@/lib/pricing";
import type { PricingRule } from "@repo/shared";
import { KPI_CATALOG_BY_KEY, PRICABLE_METRICS } from "@repo/shared";
import { formatKpiValue } from "@/lib/kpi-format";
import {
  formatRuleComponents,
  formatRuleEffectiveDate,
} from "@/lib/pricing-format";

function RuleDisplay({ rule }: { rule: PricingRule }) {
  const components = formatRuleComponents(rule);

  return (
    <div className="flex flex-col gap-1">
      <span className="font-medium text-foreground">قانون قیمت‌گذاری</span>
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
        از {formatRuleEffectiveDate(rule.effectiveFrom)}
      </span>
    </div>
  );
}

function PricedRow({ entry }: { entry: PricedKpi }) {
  const definition = KPI_CATALOG_BY_KEY.get(entry.metric);
  const hasRule = entry.rule !== null;
  const differs = entry.customerValue !== entry.rawValue;

  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-3 py-3">
        <span className="font-medium">{definition?.label ?? entry.metric}</span>
      </td>

      <td className="px-3 py-3">
        <span className="tabular-nums text-muted-foreground">
          {formatKpiValue(entry.metric, entry.rawValue)}
        </span>
      </td>

      <td className="px-3 py-3">
        {hasRule && entry.rule ? (
          <RuleDisplay rule={entry.rule} />
        ) : (
          <span className="text-sm text-muted-foreground">بدون قانون قیمت‌گذاری</span>
        )}
      </td>

      <td className="px-3 py-3">
        <div className="flex flex-col items-start gap-1">
          <span
            className={`text-base font-semibold tabular-nums ${
              differs ? "text-primary" : "text-foreground"
            }`}
          >
            {formatKpiValue(entry.metric, entry.customerValue)}
          </span>
          {hasRule && differs && (
            <span className="rounded-md bg-emerald-600/10 px-1.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              قیمت‌گذاری اعمال شد
            </span>
          )}
          {!hasRule && (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              بدون تغییر
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
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">قیمت‌گذاری مشتری</h2>
        <p className="text-xs text-muted-foreground">
          {verification.clientName} — {verification.clientId}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium text-right">متریک</th>
              <th className="px-3 py-2 font-medium text-right">ارزش خام متا</th>
              <th className="px-3 py-2 font-medium text-right">قانون قیمت‌گذاری</th>
              <th className="px-3 py-2 font-medium text-right">ارزش مشتری</th>
            </tr>
          </thead>
          <tbody>
            {PRICABLE_METRICS.map((metric) => {
              const entry = verification.priced.find((p) => p.metric === metric);
              if (!entry) return null;
              return <PricedRow key={metric} entry={entry} />;
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}