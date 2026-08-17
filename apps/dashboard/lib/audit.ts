import { SqliteAuditLogRepository } from "@repo/database";
import type {
  AdAccount,
  AuditLogRepository,
  Client,
  DashboardKpiKey,
  Package,
  PricingRule,
  User,
} from "@repo/shared";
import { getDatabase } from "@/lib/db";

/**
 * Server-only. The single audit write path for financially and
 * security-relevant admin actions (package management, package
 * assignment, pricing configuration, KPI configuration).
 *
 * Storage-agnostic: this service speaks only to the AuditLogRepository
 * interface, never to a storage engine. The default wiring builds the
 * existing SQLite implementation on the shared database handle; a
 * future Supabase implementation can be swapped in without touching
 * any action code.
 *
 * Recording rules:
 *   - Every entry identifies the actor (user id), the action, the
 *     target (type + id) and a timestamp (server-generated). Metadata
 *     carries only the minimal structured context needed to understand
 *     the change — never secrets, session cookies, tokens, emails, or
 *     raw Meta snapshots/payloads.
 *   - Entries are append-only: the repository contract offers no
 *     update or delete path, and this service never mutates existing
 *     rows.
 *   - Callers record ONLY after the underlying operation succeeded, so
 *     a failed operation never produces a success audit entry.
 */

export const AUDIT_ACTIONS = {
  PACKAGE_ASSIGNED: "package.assigned",
  PACKAGE_CREATED: "package.created",
  PACKAGE_UPDATED: "package.updated",
  PRICING_RULE_CREATED: "pricing_rule.created",
  KPI_CONFIG_CHANGED: "kpi_config.changed",
  CLIENT_CREATED: "client.created",
  CLIENT_DEACTIVATED: "client.deactivated",
  AD_ACCOUNT_CREATED: "ad_account.created",
  AD_ACCOUNT_SOURCE_UPDATED: "ad_account.source_updated",
  AD_ACCOUNT_STATUS_UPDATED: "ad_account.status_updated",
  DATA_EXPORT_CREATED: "data_export.created",
} as const;

export const AUDIT_TARGET_TYPES = {
  CLIENT: "client",
  PACKAGE: "package",
  AD_ACCOUNT: "ad_account",
} as const;

/** The acting user. Only identity fields are recorded — never secrets. */
export type AuditActor = Pick<User, "id" | "role">;

export type AuditMetadata = Record<string, unknown>;

export class AuditService {
  constructor(private readonly repo: AuditLogRepository) {}

  private async append(
    actor: AuditActor,
    action: string,
    targetEntityType: string,
    targetEntityId: string,
    metadata: AuditMetadata
  ): Promise<void> {
    await this.repo.append({
      actorUserId: actor.id,
      action,
      targetEntityType,
      targetEntityId,
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
    });
  }

  async recordPackageAssigned(
    actor: AuditActor,
    clientId: string,
    previousPackageId: string | null,
    packageId: string
  ): Promise<void> {
    await this.append(
      actor,
      AUDIT_ACTIONS.PACKAGE_ASSIGNED,
      AUDIT_TARGET_TYPES.CLIENT,
      clientId,
      {
        previousPackageId,
        packageId,
      }
    );
  }

  async recordPackageCreated(
    actor: AuditActor,
    pkg: Pick<Package, "id" | "name" | "code">
  ): Promise<void> {
    await this.append(
      actor,
      AUDIT_ACTIONS.PACKAGE_CREATED,
      AUDIT_TARGET_TYPES.PACKAGE,
      pkg.id,
      {
        name: pkg.name,
        code: pkg.code,
      }
    );
  }

  async recordPackageUpdated(
    actor: AuditActor,
    packageId: string,
    pkg: Pick<Package, "name" | "code">
  ): Promise<void> {
    await this.append(
      actor,
      AUDIT_ACTIONS.PACKAGE_UPDATED,
      AUDIT_TARGET_TYPES.PACKAGE,
      packageId,
      {
        name: pkg.name,
        code: pkg.code,
      }
    );
  }

  async recordPricingRuleCreated(actor: AuditActor, rule: PricingRule): Promise<void> {
    await this.append(
      actor,
      AUDIT_ACTIONS.PRICING_RULE_CREATED,
      AUDIT_TARGET_TYPES.CLIENT,
      rule.clientId,
      {
        ruleId: rule.id,
        metric: rule.metric,
        percentageMarkup: rule.percentageMarkup,
        fixedMarkup: rule.fixedMarkup,
        minimumCustomerValue: rule.minimumCustomerValue,
        effectiveFrom: rule.effectiveFrom.toISOString(),
      }
    );
  }

  async recordKpiConfigChanged(
    actor: AuditActor,
    clientId: string,
    visibleMetrics: DashboardKpiKey[],
    previousVisibleMetrics: DashboardKpiKey[]
  ): Promise<void> {
    await this.append(
      actor,
      AUDIT_ACTIONS.KPI_CONFIG_CHANGED,
      AUDIT_TARGET_TYPES.CLIENT,
      clientId,
      {
        visibleMetrics,
        previousVisibleMetrics,
      }
    );
  }

  async recordClientCreated(
    actor: AuditActor,
    client: Pick<Client, "id" | "name" | "packageId">
  ): Promise<void> {
    await this.append(
      actor,
      AUDIT_ACTIONS.CLIENT_CREATED,
      AUDIT_TARGET_TYPES.CLIENT,
      client.id,
      {
        name: client.name,
        packageId: client.packageId,
      }
    );
  }

  async recordClientDeactivated(
    actor: AuditActor,
    client: Pick<Client, "id" | "name">
  ): Promise<void> {
    await this.append(
      actor,
      AUDIT_ACTIONS.CLIENT_DEACTIVATED,
      AUDIT_TARGET_TYPES.CLIENT,
      client.id,
      {
        name: client.name,
      }
    );
  }

  async recordAdAccountCreated(
    actor: AuditActor,
    adAccount: Pick<AdAccount, "id" | "clientId" | "name" | "source">
  ): Promise<void> {
    await this.append(
      actor,
      AUDIT_ACTIONS.AD_ACCOUNT_CREATED,
      AUDIT_TARGET_TYPES.AD_ACCOUNT,
      adAccount.id,
      {
        clientId: adAccount.clientId,
        name: adAccount.name,
        source: adAccount.source,
      }
    );
  }

  async recordAdAccountSourceUpdated(
    actor: AuditActor,
    adAccount: Pick<AdAccount, "id" | "clientId" | "name">,
    previous: {
      source: AdAccount["source"];
      metaAdAccountId: string | null;
    }
  ): Promise<void> {
    await this.append(
      actor,
      AUDIT_ACTIONS.AD_ACCOUNT_SOURCE_UPDATED,
      AUDIT_TARGET_TYPES.AD_ACCOUNT,
      adAccount.id,
      {
        clientId: adAccount.clientId,
        name: adAccount.name,
        previousSource: previous.source,
        previousMetaAdAccountId: previous.metaAdAccountId,
      }
    );
  }

  async recordAdAccountStatusUpdated(
    actor: AuditActor,
    adAccount: Pick<AdAccount, "id" | "clientId" | "name">,
    previousStatus: AdAccount["status"]
  ): Promise<void> {
    await this.append(
      actor,
      AUDIT_ACTIONS.AD_ACCOUNT_STATUS_UPDATED,
      AUDIT_TARGET_TYPES.AD_ACCOUNT,
      adAccount.id,
      {
        clientId: adAccount.clientId,
        name: adAccount.name,
        previousStatus,
      }
    );
  }

  async recordDataExport(
    actor: AuditActor,
    clientId: string,
    metadata: {
      rangeDays: number;
      rowCount: number;
    }
  ): Promise<void> {
    await this.append(
      actor,
      AUDIT_ACTIONS.DATA_EXPORT_CREATED,
      AUDIT_TARGET_TYPES.CLIENT,
      clientId,
      {
        rangeDays: metadata.rangeDays,
        rowCount: metadata.rowCount,
      }
    );
  }
}

/** Convenience wiring for the current SQLite storage engine. */
export function sqliteAuditService(db: ReturnType<typeof getDatabase>): AuditService {
  return new AuditService(new SqliteAuditLogRepository(db));
}