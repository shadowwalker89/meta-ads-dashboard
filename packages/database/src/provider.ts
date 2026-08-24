import type { Database } from "better-sqlite3";
import type {
  AdminAssignmentRepository,
  AdAccountRepository,
  AuditLogRepository,
  CampaignRepository,
  ClientRepository,
  CollectorJobRepository,
  DashboardPreferenceRepository,
  InsightSnapshotRepository,
  PackageRepository,
  PricingRuleRepository,
  UserRepository,
} from "@repo/shared";
import {
  SqliteAdminAssignmentRepository,
  SqliteAdAccountRepository,
  SqliteAuditLogRepository,
  SqliteCampaignRepository,
  SqliteClientRepository,
  SqliteCollectorJobRepository,
  SqliteDashboardPreferenceRepository,
  SqliteInsightSnapshotRepository,
  SqlitePackageRepository,
  SqlitePricingRuleRepository,
  SqliteUserRepository,
} from "./repositories/index.js";

/**
 * Storage backends this package can serve. Only SQLite exists today;
 * the future Supabase/PostgreSQL provider is added as a second union
 * member WITHOUT changing this type's consumers.
 */
export type DatabaseProviderName = "sqlite";

/**
 * Environment shape the provider resolver reads. The index signature
 * lets callers pass process.env directly.
 */
export interface DatabaseProviderEnv {
  DATABASE_PROVIDER?: string;
  [key: string]: string | undefined;
}

/**
 * Resolves which storage provider this runtime must use. Pure and free
 * of any side effects so callers can pass an explicit env-like object
 * (tests never touch process.env).
 *
 * Absent/empty DATABASE_PROVIDER defaults to "sqlite" — the behavior of
 * every existing consumer stays identical. An explicitly unsupported
 * value throws instead of silently falling back: a misconfigured
 * deployment must fail loudly at startup, never read or write through
 * the wrong backend.
 */
export function resolveDatabaseProvider(
  env: DatabaseProviderEnv
): DatabaseProviderName {
  const provided = env.DATABASE_PROVIDER;

  if (provided === undefined || provided === "") {
    return "sqlite";
  }
  if (provided === "sqlite") {
    return "sqlite";
  }
  throw new Error(
    `Unsupported DATABASE_PROVIDER '${provided}'. Supported values: sqlite.`
  );
}

/**
 * The complete repository bundle used by the Dashboard and Collector.
 * Typed against the storage-agnostic interfaces in @repo/shared — a
 * future Supabase implementation only needs to satisfy these members;
 * no consumer of createRepositories() changes.
 */
export interface RepositoryBundle {
  clientRepository: ClientRepository;
  adAccountRepository: AdAccountRepository;
  campaignRepository: CampaignRepository;
  insightSnapshotRepository: InsightSnapshotRepository;
  collectorJobRepository: CollectorJobRepository;
  packageRepository: PackageRepository;
  userRepository: UserRepository;
  adminAssignmentRepository: AdminAssignmentRepository;
  dashboardPreferenceRepository: DashboardPreferenceRepository;
  auditLogRepository: AuditLogRepository;
  pricingRuleRepository: PricingRuleRepository;
}

/**
 * Single construction point for repositories ("the provider seam").
 *
 * Callers hand in the database handle they already own; the SQLite
 * branch constructs exactly the same Sqlite*Repository classes on that
 * handle they would have constructed themselves — no wrapper, no
 * changed semantics. The Supabase branch will live behind this same
 * call signature when Phase 3 arrives.
 */
export function createRepositories(
  db: Database,
  env: DatabaseProviderEnv = process.env
): RepositoryBundle {
  const provider = resolveDatabaseProvider(env);

  // Only SQLite exists today. The guard keeps a future non-sqlite value
  // a compile-time-visible branch point instead of a silent fallback.
  if (provider !== "sqlite") {
    throw new Error(
      `Unsupported DATABASE_PROVIDER '${String(provider)}'. Supported values: sqlite.`
    );
  }

  return {
    clientRepository: new SqliteClientRepository(db),
    adAccountRepository: new SqliteAdAccountRepository(db),
    campaignRepository: new SqliteCampaignRepository(db),
    insightSnapshotRepository: new SqliteInsightSnapshotRepository(db),
    collectorJobRepository: new SqliteCollectorJobRepository(db),
    packageRepository: new SqlitePackageRepository(db),
    userRepository: new SqliteUserRepository(db),
    adminAssignmentRepository: new SqliteAdminAssignmentRepository(db),
    dashboardPreferenceRepository: new SqliteDashboardPreferenceRepository(db),
    auditLogRepository: new SqliteAuditLogRepository(db),
    pricingRuleRepository: new SqlitePricingRuleRepository(db),
  };
}
