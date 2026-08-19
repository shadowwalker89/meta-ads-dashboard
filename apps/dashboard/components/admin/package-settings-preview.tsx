"use client";

import type {
  DashboardKpiKey,
  Package,
  PackageFeatures,
  PackagePricingDefaults,
} from "@repo/shared";
import { PRICABLE_METRICS } from "@repo/shared";
import { formatRuleComponents } from "@/lib/pricing-format";
import { useDashboardLang } from "@/components/layout/language-provider";
import {
  getAdminKpiTitle,
} from "@/lib/i18n/strings";

/**
 * Presentational. Renders a package's effective settings (entitlements,
 * defaults, features, pricing defaults) from the Package entity — the
 * same data the package-settings resolver and pricing model use. It only
 * formats stored data; it never calculates pricing and never hard-codes
 * tier names.
 *
 * KPI names are shown with their official ENGLISH titles in both
 * languages (deliberate product decision for the Admin panel); all other
 * labels follow the dashboard language.
 */

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-left tabular-nums">{value}</span>
    </div>
  );
}

function formatKpis(
  kpis: readonly DashboardKpiKey[],
  separator: string
): string {
  if (kpis.length === 0) return "—";
  return kpis.map((key) => getAdminKpiTitle(key)).join(separator);
}

function formatFeatures(
  features: PackageFeatures,
  labels: { key: keyof PackageFeatures; label: string }[]
): string {
  const enabled = labels
    .filter((feature) => features[feature.key])
    .map((feature) => feature.label);
  return enabled.length > 0 ? enabled.join("، ") : "—";
}

function formatPricingDefaults(
  defaults: PackagePricingDefaults,
  separator: string
): string {
  const parts: string[] = [];
  for (const metric of PRICABLE_METRICS) {
    const config = defaults[metric];
    if (!config) continue;
    const components = formatRuleComponents(config);
    if (components.length > 0) {
      parts.push(`${getAdminKpiTitle(metric)}: ${components.join(separator)}`);
    }
  }
  return parts.length > 0 ? parts.join("؛ ") : "—";
}

export function PackageSettingsPreview({ pkg }: { pkg: Package }) {
  const { lang, strings: t } = useDashboardLang();
  const separator = lang === "fa" ? "، " : ", ";

  const featureLabels: { key: keyof PackageFeatures; label: string }[] = [
    { key: "charts", label: t.featureCharts },
    { key: "dataExport", label: t.featureDataExport },
    { key: "advancedReporting", label: t.featureAdvancedReporting },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">{pkg.name}</span>
        {pkg.code !== null && (
          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary tabular-nums">
            {pkg.code}
          </span>
        )}
      </div>
      {pkg.description && (
        <p className="text-xs text-muted-foreground">{pkg.description}</p>
      )}
      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <Row
          label={t.pkgCollectionFrequency}
          value={String(pkg.collectionFrequency)}
        />
        <Row
          label={t.pkgMaxAdAccounts}
          value={pkg.maxAdAccounts === null ? t.pkgUnlimited : String(pkg.maxAdAccounts)}
        />
        <Row
          label={t.pkgMaxCampaigns}
          value={pkg.maxCampaigns === null ? t.pkgUnlimited : String(pkg.maxCampaigns)}
        />
        <Row
          label={t.pkgRetentionDays}
          value={pkg.retentionDays === null ? t.pkgUnlimited : String(pkg.retentionDays)}
        />
        <Row label={t.pkgDefaultKpis} value={formatKpis(pkg.defaultVisibleKpis, separator)} />
        <Row label={t.pkgFeatures} value={formatFeatures(pkg.features, featureLabels)} />
        <Row
          label={t.pkgPricingDefaults}
          value={formatPricingDefaults(pkg.pricingDefaults, separator)}
        />
      </div>
    </div>
  );
}