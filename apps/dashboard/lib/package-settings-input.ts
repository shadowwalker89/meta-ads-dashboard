import type {
  DashboardKpiKey,
  Package,
  PackageFeatures,
  PackagePricingDefaults,
} from "@repo/shared";

/**
 * Pure. The full editable package settings surface, plus the conversion
 * between a stored Package and that surface. Server-safe (no DB imports)
 * so both the server lib and the client package form can use it.
 */
export interface PackageSettingsInput {
  name: string;
  description: string;
  code: string;
  collectionFrequency: number;
  maxAdAccounts: number | null;
  maxCampaigns: number | null;
  retentionDays: number | null;
  defaultVisibleKpis: DashboardKpiKey[];
  features: PackageFeatures;
  pricingDefaults: PackagePricingDefaults;
}

/** Maps a stored Package to the full editable form input shape. */
export function toPackageSettingsInput(pkg: Package): PackageSettingsInput {
  return {
    name: pkg.name,
    description: pkg.description,
    code: pkg.code ?? "",
    collectionFrequency: pkg.collectionFrequency,
    maxAdAccounts: pkg.maxAdAccounts,
    maxCampaigns: pkg.maxCampaigns,
    retentionDays: pkg.retentionDays,
    defaultVisibleKpis: [...pkg.defaultVisibleKpis],
    features: { ...pkg.features },
    pricingDefaults: pkg.pricingDefaults,
  };
}