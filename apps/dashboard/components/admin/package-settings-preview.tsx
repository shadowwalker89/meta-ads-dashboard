import type {
  DashboardKpiKey,
  Package,
  PackageFeatures,
  PackagePricingDefaults,
} from "@repo/shared";
import { KPI_CATALOG_BY_KEY, PRICABLE_METRICS } from "@repo/shared";
import { formatRuleComponents } from "@/lib/pricing-format";

/**
 * Presentational. Renders a package's effective settings (entitlements,
 * defaults, features, pricing defaults) from the Package entity — the
 * same data the package-settings resolver and pricing model use. It only
 * formats stored data; it never calculates pricing and never hard-codes
 * tier names.
 */

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-left tabular-nums">{value}</span>
    </div>
  );
}

function formatKpis(kpis: readonly DashboardKpiKey[]): string {
  if (kpis.length === 0) return "—";
  return kpis
    .map((key) => KPI_CATALOG_BY_KEY.get(key)?.label ?? key)
    .join("، ");
}

const FEATURE_LABELS: { key: keyof PackageFeatures; label: string }[] = [
  { key: "charts", label: "نمودار" },
  { key: "dataExport", label: "خروجی داده" },
  { key: "advancedReporting", label: "گزارش پیشرفته" },
];

function formatFeatures(features: PackageFeatures): string {
  const enabled = FEATURE_LABELS.filter((feature) => features[feature.key]).map(
    (feature) => feature.label
  );
  return enabled.length > 0 ? enabled.join("، ") : "—";
}

function formatPricingDefaults(defaults: PackagePricingDefaults): string {
  const parts: string[] = [];
  for (const metric of PRICABLE_METRICS) {
    const config = defaults[metric];
    if (!config) continue;
    const label = KPI_CATALOG_BY_KEY.get(metric)?.label ?? metric;
    const components = formatRuleComponents(config);
    if (components.length > 0) {
      parts.push(`${label}: ${components.join("، ")}`);
    }
  }
  return parts.length > 0 ? parts.join("؛ ") : "—";
}

export function PackageSettingsPreview({ pkg }: { pkg: Package }) {
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
          label="دفعات جمع‌آوری در روز"
          value={String(pkg.collectionFrequency)}
        />
        <Row
          label="حداکثر اکانت تبلیغاتی"
          value={pkg.maxAdAccounts === null ? "نامحدود" : String(pkg.maxAdAccounts)}
        />
        <Row
          label="حداکثر کمپین"
          value={pkg.maxCampaigns === null ? "نامحدود" : String(pkg.maxCampaigns)}
        />
        <Row
          label="نگهداری داده (روز)"
          value={pkg.retentionDays === null ? "نامحدود" : String(pkg.retentionDays)}
        />
        <Row label="KPI پیش‌فرض" value={formatKpis(pkg.defaultVisibleKpis)} />
        <Row label="امکانات" value={formatFeatures(pkg.features)} />
        <Row label="پیش‌فرض قیمت‌گذاری" value={formatPricingDefaults(pkg.pricingDefaults)} />
      </div>
    </div>
  );
}