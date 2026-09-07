import type { Database } from "better-sqlite3";
import type {
  AdminAssignmentRepository,
  AdAccountRepository,
  AuditLogRepository,
  CampaignAssignmentRepository,
  CampaignRepository,
  ClientRepository,
  CollectorJobRepository,
  DashboardPreferenceRepository,
  InsightSnapshotRepository,
  PackageRepository,
  PricingRuleRepository,
  UserRepository,
} from "@repo/shared";
import type { PostgresDatabase } from "./client-pg.js";
import { openPostgresDatabase } from "./client-pg.js";
import {
  SqliteAdminAssignmentRepository,
  SqliteAdAccountRepository,
  SqliteAuditLogRepository,
  SqliteCampaignAssignmentRepository,
  SqliteCampaignRepository,
  SqliteClientRepository,
  SqliteCollectorJobRepository,
  SqliteDashboardPreferenceRepository,
  SqliteInsightSnapshotRepository,
  SqlitePackageRepository,
  SqlitePricingRuleRepository,
  SqliteUserRepository,
} from "./repositories/index.js";
import { PgAdminAssignmentRepository } from "./repositories/admin-assignment.repository.pg.js";
import { PgAdAccountRepository } from "./repositories/ad-account.repository.pg.js";
import { PgAuditLogRepository } from "./repositories/audit-log.repository.pg.js";
import { PgCampaignRepository } from "./repositories/campaign.repository.pg.js";
import { PgClientRepository } from "./repositories/client.repository.pg.js";
import { PgCollectorJobRepository } from "./repositories/collector-job.repository.pg.js";
import { PgDashboardPreferenceRepository } from "./repositories/dashboard-preference.repository.pg.js";
import { PgInsightSnapshotRepository } from "./repositories/insight-snapshot.repository.pg.js";
import { PgPackageRepository } from "./repositories/package.repository.pg.js";
import { PgPricingRuleRepository } from "./repositories/pricing-rule.repository.pg.js";
import { PgUserRepository } from "./repositories/user.repository.pg.js";
import { PgCampaignAssignmentRepository } from "./repositories/campaign-assignment.repository.pg.js";

/**
 * Storage backends this package can serve. SQLite is the default;
 * "supabase" selects the PostgreSQL provider through Supabase's
 * session-mode connection (DATABASE_URL).
 */
export type DatabaseProviderName = "sqlite" | "supabase";

/**
 * The handle types the provider branches understand: better-sqlite3's
 * synchronous database and the PostgreSQL pool facade from client-pg.
 * Purely a TYPE today — no consumer is force-migrated; future Supabase
 * wiring (and the eventual widening of dashboard Db aliases) uses this
 * instead of the SQLite-specific annotation.
 */
export type StorageHandle = Database | PostgresDatabase;

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
  if (provided === "supabase") {
    return "supabase";
  }
  throw new Error(
    `Unsupported DATABASE_PROVIDER '${provided}'. Supported values: sqlite, supabase.`
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
  campaignAssignmentRepository: CampaignAssignmentRepository;
}

/**
 * Single construction point for repositories ("the provider seam").
 *
 * SQLite branch: callers hand in the Database handle they already own;
 * exactly the same Sqlite*Repository classes are constructed on it —
 * no wrapper, no changed semantics.
 *
 * Supabase branch: the db parameter is ignored; the shared
 * process-wide PostgresDatabase handle is opened lazily from
 * DATABASE_URL. All 11 Pg*Repository implementations are wired.
 */
export function createRepositories(
  db: Database,
  env: DatabaseProviderEnv = process.env
): RepositoryBundle {
  const provider = resolveDatabaseProvider(env);

  if (provider === "supabase") {
    const pgDb = openPostgresDatabase();
    return {
      clientRepository: new PgClientRepository(pgDb),
      adAccountRepository: new PgAdAccountRepository(pgDb),
      campaignRepository: new PgCampaignRepository(pgDb),
      insightSnapshotRepository: new PgInsightSnapshotRepository(pgDb),
      collectorJobRepository: new PgCollectorJobRepository(pgDb),
      packageRepository: new PgPackageRepository(pgDb),
      userRepository: new PgUserRepository(pgDb),
      adminAssignmentRepository: new PgAdminAssignmentRepository(pgDb),
      dashboardPreferenceRepository: new PgDashboardPreferenceRepository(pgDb),
      auditLogRepository: new PgAuditLogRepository(pgDb),
      pricingRuleRepository: new PgPricingRuleRepository(pgDb),
      campaignAssignmentRepository: new PgCampaignAssignmentRepository(pgDb),
    };
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
    campaignAssignmentRepository: new SqliteCampaignAssignmentRepository(db),
  };
}
