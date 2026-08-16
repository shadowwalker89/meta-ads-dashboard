import type { Package, PackageFeatures } from "./entities";
import type { DashboardKpiKey } from "./kpi-catalog";
import { sanitizeDashboardKpiKeys } from "./kpi-catalog";

/**
 * Package settings — the typed tier configuration foundation.
 *
 * Packages are plain data rows (not enums or hard-coded constants), so
 * Gold/Silver/Bronze and any future tier are created/edited as data.
 * This module only holds the shared defaults and the pure sanitizers
 * used at the storage boundary; no tier-specific business logic lives
 * here or anywhere in TypeScript.
 */

/** Conservative fallback when a client has no resolvable package. */
export const DEFAULT_COLLECTION_FREQUENCY = 1;

export const DEFAULT_PACKAGE_FEATURES: PackageFeatures = {
  charts: false,
  dataExport: false,
  advancedReporting: false,
};

/**
 * Reduces arbitrary persisted JSON to a safe PackageFeatures. Unknown
 * keys are dropped; missing booleans default to false. Corrupt shapes
 * become the all-false default.
 */
export function sanitizePackageFeatures(input: unknown): PackageFeatures {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ...DEFAULT_PACKAGE_FEATURES };
  }
  const raw = input as Record<string, unknown>;
  return {
    charts: raw.charts === true,
    dataExport: raw.dataExport === true,
    advancedReporting: raw.advancedReporting === true,
  };
}

/**
 * Reduces arbitrary persisted JSON to a safe ordered list of known KPI
 * keys. Reuses the existing catalog sanitizer so invalid/obsolete keys
 * are silently dropped, never surfaced or thrown on.
 */
export function sanitizePackageDefaultKpis(input: unknown): DashboardKpiKey[] {
  return Array.isArray(input) ? sanitizeDashboardKpiKeys(input) : [];
}

/**
 * True when a package carries the minimum structural identity required
 * to be a tier row: a non-empty code and a positive collection
 * frequency. Enforced at the repository write boundary.
 */
export function isValidPackageSettings(
  pkg: Pick<Package, "code" | "collectionFrequency">
): boolean {
  return (
    typeof pkg.code === "string" &&
    pkg.code.trim().length > 0 &&
    Number.isInteger(pkg.collectionFrequency) &&
    pkg.collectionFrequency > 0
  );
}