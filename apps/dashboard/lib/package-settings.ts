import type {
  DashboardKpiKey,
  Package,
  PackageFeatures,
  PackagePricingDefaults,
} from "@repo/shared";
import {
  DEFAULT_COLLECTION_FREQUENCY,
  DEFAULT_PACKAGE_FEATURES,
  resolveVisibleKpis,
} from "@repo/shared";
import { getDatabase, getRepositories } from "@/lib/db";

type Db = ReturnType<typeof getDatabase>;

/**
 * Effective Package Settings — the client's resolved tier configuration.
 *
 * Resolution is read-time and follows one consistent precedence:
 *
 *   Package defaults → Client overrides → Effective configuration
 *
 * where "entitlements" (collection frequency, ad-account/campaign
 * limits, features) are package-authoritative and never overridable by
 * a client, while "starting values" (KPI visibility, pricing) default
 * from the package but give way to the already-existing per-client
 * systems (DashboardPreference, PricingRule).
 *
 * Server-only: this module talks to SQLite. The pure resolver below is
 * deliberately separated so the precedence logic is unit-testable
 * without a database.
 */

export interface EffectivePackageSettings {
  clientId: string;
  /** Package the client belongs to; null when unresolved. */
  packageId: string | null;
  /** Stable tier code (bronze/silver/gold); null for legacy/unresolved. */
  code: string | null;
  /** Collections per day — package-authoritative. */
  collectionFrequency: number;
  /** Max connected ad accounts; null = unlimited — package-authoritative. */
  maxAdAccounts: number | null;
  /** Max tracked campaigns; null = unlimited — package-authoritative. */
  maxCampaigns: number | null;
  /** Report-history retention days; null = keep indefinitely. */
  retentionDays: number | null;
  /**
   * KPI visibility: client DashboardPreference → package default →
   * global default. This is the resolution layer only; the dashboard
   * still reads visible KPIs through the existing KPI config service.
   */
  visibleKpis: DashboardKpiKey[];
  /** Feature entitlements — package-authoritative. */
  features: PackageFeatures;
  /**
   * Package pricing DEFAULTS only. The runtime customer value always
   * comes from the client-scoped PricingRule foundation; these defaults
   * are the material for seeding per-client rules later.
   */
  pricingDefaults: PackagePricingDefaults;
}

export interface ClientPackageResolutionInput {
  clientId: string;
  packageId: string | null;
  clientPreference: { visibleMetrics: readonly unknown[] } | null;
  pkg: Package | null;
}

/**
 * Pure. Resolves a client's effective package settings from its package
 * row (or absence of one) plus its KPI preference. Never touches
 * storage. When the client or package is missing it returns conservative
 * defaults so callers never crash on incomplete data.
 */
export function resolveClientPackageSettings(
  input: ClientPackageResolutionInput
): EffectivePackageSettings {
  return {
    clientId: input.clientId,
    packageId: input.packageId,
    code: input.pkg?.code ?? null,
    collectionFrequency:
      input.pkg?.collectionFrequency ?? DEFAULT_COLLECTION_FREQUENCY,
    maxAdAccounts: input.pkg?.maxAdAccounts ?? null,
    maxCampaigns: input.pkg?.maxCampaigns ?? null,
    retentionDays: input.pkg?.retentionDays ?? null,
    visibleKpis: resolveVisibleKpis(
      input.clientPreference,
      input.pkg?.defaultVisibleKpis
    ),
    features: input.pkg?.features ?? { ...DEFAULT_PACKAGE_FEATURES },
    pricingDefaults: input.pkg?.pricingDefaults ?? {},
  };
}

/**
 * Server-only. Loads a client → its package → the effective package
 * settings. Missing client or package falls back to conservative
 * defaults rather than throwing. The database handle is injectable for
 * tests (defaults to getDatabase()).
 */
export async function getClientPackageSettings(
  clientId: string,
  db: Db = getDatabase()
): Promise<EffectivePackageSettings> {
  const {
    clientRepository,
    dashboardPreferenceRepository,
    packageRepository,
  } = getRepositories(db);
  const client = await clientRepository.findById(clientId);
  if (!client) {
    return resolveClientPackageSettings({
      clientId,
      packageId: null,
      clientPreference: null,
      pkg: null,
    });
  }

  const pkg = await packageRepository.findById(client.packageId);
  const preference = await dashboardPreferenceRepository.findForClient(
    clientId
  );

  return resolveClientPackageSettings({
    clientId,
    packageId: client.packageId,
    clientPreference: preference,
    pkg,
  });
}