"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import type { PricingMetric } from "@repo/shared";
import { PRICABLE_METRICS } from "@repo/shared";
import { Button } from "@/components/ui/button";
import { useDashboardLang } from "@/components/layout/language-provider";
import {
  getAdminKpiTitle,
  tpl,
  type AppLanguage,
  type DashboardStrings,
} from "@/lib/i18n/strings";
import type {
  ClientPricingConfigData,
  PricingMetricConfig,
} from "@/lib/pricing-admin";
import type { PricingRule } from "@repo/shared";
import { formatKpiValue } from "@/lib/kpi-format";
import {
  formatRuleComponents,
  formatRuleEffectiveDate,
} from "@/lib/pricing-format";
import {
  hasPricingRuleComponents,
  previewPricingValue,
  type PricingRuleDraft,
} from "@/lib/pricing-draft";
import { createPricingRule } from "@/app/(dashboard)/admin/pricing/config/actions";

interface PricingConfiguratorProps {
  clientId: string;
  clientName: string;
  config: ClientPricingConfigData;
}

type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "success" }
  | { status: "error"; message: string };

function parseComponent(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function RuleChips({
  rule,
}: {
  rule: Pick<
    PricingRule,
    "percentageMarkup" | "fixedMarkup" | "minimumCustomerValue"
  >;
}) {
  const components = formatRuleComponents(rule);
  return (
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
  );
}

function RuleHistorySection({
  title,
  rules,
  empty,
  strings: t,
}: {
  title: string;
  rules: PricingRule[];
  empty: string;
  strings: DashboardStrings;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
      {rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="rounded-lg border border-border bg-background p-3"
            >
              <RuleChips rule={rule} />
              <span className="mt-1 block text-xs text-muted-foreground">
                {tpl(t.pricingEffectiveFrom, {
                  date: formatRuleEffectiveDate(rule.effectiveFrom),
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PreviewRow({
  metric,
  config,
  lang,
  strings: t,
}: {
  metric: PricingMetric;
  config: PricingMetricConfig;
  lang: AppLanguage;
  strings: DashboardStrings;
}) {
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">{t.pricingRawValue}</span>
        <span className="tabular-nums">
          {formatKpiValue(metric, config.rawValue, lang)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">{t.pricingRuleCurrent}</span>
        {config.currentRule ? (
          <RuleChips rule={config.currentRule} />
        ) : (
          <span className="text-muted-foreground">{t.pricingNoRuleShort}</span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">{t.pricingCustomerValue}</span>
        <span className="tabular-nums text-base font-semibold text-primary">
          {formatKpiValue(metric, config.currentCustomerValue, lang)}
        </span>
      </div>
    </div>
  );
}

export function PricingConfigurator({
  clientId,
  clientName,
  config,
}: PricingConfiguratorProps) {
  const router = useRouter();
  const { lang, strings: t } = useDashboardLang();
  const [selectedMetric, setSelectedMetric] = useState<PricingMetric>("spend");
  const [percentage, setPercentage] = useState("");
  const [fixed, setFixed] = useState("");
  const [minimum, setMinimum] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(todayIsoDate());
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });

  const metricConfig = config.byMetric[selectedMetric];

  const draft: PricingRuleDraft = {
    clientId,
    metric: selectedMetric,
    percentageMarkup:
      parseComponent(percentage) !== null
        ? (parseComponent(percentage) as number) / 100
        : null,
    fixedMarkup: parseComponent(fixed),
    minimumCustomerValue: parseComponent(minimum),
    effectiveFrom: new Date(`${effectiveFrom}T00:00:00`),
  };

  const hasComponents = hasPricingRuleComponents(draft);
  const effectiveDateValid = !Number.isNaN(draft.effectiveFrom.getTime());
  const canSave = hasComponents && effectiveDateValid;

  function handleMetricChange(metric: PricingMetric) {
    setSelectedMetric(metric);
    setSaveState({ status: "idle" });
  }

  function handleComponentChange(setter: (value: string) => void) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      setter(event.target.value);
      setSaveState({ status: "idle" });
    };
  }

  async function handleSave() {
    if (!canSave) return;
    setSaveState({ status: "saving" });

    const result = await createPricingRule({
      clientId,
      metric: selectedMetric,
      percentageMarkup: draft.percentageMarkup,
      fixedMarkup: draft.fixedMarkup,
      minimumCustomerValue: draft.minimumCustomerValue,
      effectiveFrom: draft.effectiveFrom.toISOString(),
    });

    if (result.ok) {
      setPercentage("");
      setFixed("");
      setMinimum("");
      setSaveState({ status: "success" });
      router.refresh();
    } else {
      setSaveState({ status: "error", message: result.error });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">{t.pricingNewRuleTitle}</h2>
          <p className="text-xs text-muted-foreground">
            {clientName} — {clientId}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="pricing-metric-select"
            className="text-sm font-medium text-muted-foreground"
          >
            {t.pricingMetric}
          </label>
          <select
            id="pricing-metric-select"
            value={selectedMetric}
            onChange={(e) =>
              handleMetricChange(e.target.value as PricingMetric)
            }
            className="h-9 w-full max-w-sm rounded-md border border-border bg-background px-3 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
          >
            {PRICABLE_METRICS.map((metric) => (
              <option key={metric} value={metric}>
                {getAdminKpiTitle(metric)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="pricing-percentage"
                className="text-sm font-medium text-muted-foreground"
              >
                {t.pricingPercentage}
              </label>
              <input
                id="pricing-percentage"
                type="number"
                min="0"
                step="any"
                value={percentage}
                onChange={handleComponentChange(setPercentage)}
                placeholder={t.pricingPercentagePlaceholder}
                className="h-9 w-full max-w-sm rounded-md border border-border bg-background px-3 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="pricing-fixed"
                className="text-sm font-medium text-muted-foreground"
              >
                {t.pricingFixed}
              </label>
              <input
                id="pricing-fixed"
                type="number"
                min="0"
                step="any"
                value={fixed}
                onChange={handleComponentChange(setFixed)}
                placeholder={t.pricingFixedPlaceholder}
                className="h-9 w-full max-w-sm rounded-md border border-border bg-background px-3 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="pricing-minimum"
                className="text-sm font-medium text-muted-foreground"
              >
                {t.pricingMinimum}
              </label>
              <input
                id="pricing-minimum"
                type="number"
                min="0"
                step="any"
                value={minimum}
                onChange={handleComponentChange(setMinimum)}
                placeholder={t.pricingMinimumPlaceholder}
                className="h-9 w-full max-w-sm rounded-md border border-border bg-background px-3 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="pricing-effective"
                className="text-sm font-medium text-muted-foreground"
              >
                {t.pricingEffectiveDate}
              </label>
              <input
                id="pricing-effective"
                type="date"
                value={effectiveFrom}
                onChange={handleComponentChange(setEffectiveFrom)}
                className="h-9 w-full max-w-sm rounded-md border border-border bg-background px-3 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
              />
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={handleSave} disabled={!canSave || saveState.status === "saving"}>
                {saveState.status === "saving" ? t.pricingSaving : t.pricingSaveRule}
              </Button>
              {saveState.status === "success" && (
                <p className="text-sm text-emerald-600">{t.pricingRuleSaved}</p>
              )}
              {saveState.status === "error" && (
                <p className="text-sm text-destructive">{saveState.message}</p>
              )}
            </div>

            {!hasComponents && (
              <p className="text-xs text-muted-foreground">
                {t.pricingComponentsHint}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4">
            <h3 className="text-sm font-semibold">
              {tpl(t.pricingPreviewTitle, { kpi: getAdminKpiTitle(selectedMetric) })}
            </h3>
            <PreviewRow
              metric={selectedMetric}
              config={metricConfig}
              lang={lang}
              strings={t}
            />
            <div className="flex flex-col gap-1.5 border-t border-border pt-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{t.pricingPreviewNewRule}</span>
                {hasComponents ? (
                  <RuleChips rule={draft} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{t.pricingPreviewNewValue}</span>
                <span className="tabular-nums text-base font-semibold text-primary">
                  {hasComponents
                    ? formatKpiValue(
                        selectedMetric,
                        previewPricingValue(draft, metricConfig.rawValue),
                        lang
                      )
                    : "—"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t.pricingPreviewNote}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
        <h2 className="text-base font-semibold">
          {tpl(t.pricingHistoryTitle, { kpi: getAdminKpiTitle(selectedMetric) })}
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <RuleHistorySection
            title={t.pricingRuleCurrent}
            rules={metricConfig.currentRule ? [metricConfig.currentRule] : []}
            empty={t.pricingRuleCurrentEmpty}
            strings={t}
          />
          <RuleHistorySection
            title={t.pricingRuleScheduled}
            rules={metricConfig.futureRules}
            empty={t.pricingRuleScheduledEmpty}
            strings={t}
          />
          <RuleHistorySection
            title={t.pricingRuleHistorical}
            rules={metricConfig.historicalRules}
            empty={t.pricingRuleHistoricalEmpty}
            strings={t}
          />
        </div>
      </section>
    </div>
  );
}