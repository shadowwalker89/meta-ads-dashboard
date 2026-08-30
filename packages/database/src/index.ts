export { openDatabase } from "./client.js";
export { openPostgresDatabase, type PostgresDatabase, type OpenPostgresDatabaseOptions } from "./client-pg.js";
export { runMigrations } from "./migrations/migrate.js";
export {
  runPostgresMigrations,
  listPostgresMigrationFiles,
  type PostgresMigrationResult,
} from "./migrations-pg/migrate-pg.js";
export * from "./repositories/index.js";
// PostgreSQL repositories (Wave 1 + Wave 2). All 11 are now wired into
// the supabase branch of createRepositories().
export { PgInsightSnapshotRepository } from "./repositories/insight-snapshot.repository.pg.js";
export { PgPricingRuleRepository } from "./repositories/pricing-rule.repository.pg.js";
export { PgDashboardPreferenceRepository } from "./repositories/dashboard-preference.repository.pg.js";
export { PgAdminAssignmentRepository } from "./repositories/admin-assignment.repository.pg.js";
export { PgUserRepository } from "./repositories/user.repository.pg.js";
export { PgClientRepository } from "./repositories/client.repository.pg.js";
export { PgPackageRepository } from "./repositories/package.repository.pg.js";
export { PgAdAccountRepository } from "./repositories/ad-account.repository.pg.js";
export { PgCampaignRepository } from "./repositories/campaign.repository.pg.js";
export { PgAuditLogRepository } from "./repositories/audit-log.repository.pg.js";
export { PgCollectorJobRepository } from "./repositories/collector-job.repository.pg.js";
export * from "./provider.js";
// SQLite-specific services (preserved unchanged — existing tests and call
// sites that pass a raw Database handle continue to work).
export * from "./services/package-enforcement.js";
export * from "./services/package-pricing-propagation.js";
export * from "./services/package-assignment.service.js";
// Provider-neutral service variants (accept repository interfaces instead
// of a raw Database handle — used by the supabase branch and new call sites).
export { PackageEnforcement } from "./services/package-enforcement-repo.js";
export { RepositoryPackagePricingPropagation } from "./services/package-pricing-propagation-repo.js";
export {
  RepositoryPackageAssignmentService,
  createRepositoryPackageAssignmentService,
  type AssignPackageInput as RepositoryAssignPackageInput,
  type AssignPackageResult as RepositoryAssignPackageResult,
} from "./services/package-assignment.service-repo.js";
