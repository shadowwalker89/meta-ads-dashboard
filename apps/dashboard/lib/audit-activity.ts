import type {
  AuditLog,
  DashboardKpiKey,
  PageRequest,
  User,
} from "@repo/shared";
import { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from "@/lib/audit";
import { requireClientAccess } from "@/lib/access";
import { getDatabase, getRepositories } from "@/lib/db";
import {
  DASHBOARD_STRINGS,
  KPI_LABELS_EN,
  getAdminKpiTitle,
  tpl,
  type AppLanguage,
  type DashboardStrings,
} from "@/lib/i18n/strings";

type Db = ReturnType<typeof getDatabase>;
type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

const AUDIT_ACTIVITY_PAGE_SIZE = 10;
const MAX_AUDIT_ACTIVITY_PAGE_SIZE = 50;

const AUDIT_ACTION_LABEL_KEYS = {
  [AUDIT_ACTIONS.PACKAGE_ASSIGNED]: "auditActionPackageAssigned",
  [AUDIT_ACTIONS.PACKAGE_CREATED]: "auditActionPackageCreated",
  [AUDIT_ACTIONS.PACKAGE_UPDATED]: "auditActionPackageUpdated",
  [AUDIT_ACTIONS.PRICING_RULE_CREATED]: "auditActionPricingRuleCreated",
  [AUDIT_ACTIONS.KPI_CONFIG_CHANGED]: "auditActionKpiConfigChanged",
  [AUDIT_ACTIONS.CLIENT_CREATED]: "auditActionClientCreated",
  [AUDIT_ACTIONS.CLIENT_UPDATED]: "auditActionClientUpdated",
  [AUDIT_ACTIONS.CLIENT_DEACTIVATED]: "auditActionClientDeactivated",
  [AUDIT_ACTIONS.AD_ACCOUNT_CREATED]: "auditActionAdAccountCreated",
  [AUDIT_ACTIONS.AD_ACCOUNT_SOURCE_UPDATED]: "auditActionAdAccountSourceUpdated",
  [AUDIT_ACTIONS.AD_ACCOUNT_STATUS_UPDATED]: "auditActionAdAccountStatusUpdated",
  [AUDIT_ACTIONS.CAMPAIGN_ASSIGNED]: "auditActionCampaignAssigned",
  [AUDIT_ACTIONS.CAMPAIGN_ASSIGNMENT_CHANGED]: "auditActionCampaignAssignmentChanged",
  [AUDIT_ACTIONS.CAMPAIGN_ASSIGNMENT_DEACTIVATED]: "auditActionCampaignAssignmentDeactivated",
  [AUDIT_ACTIONS.DATA_EXPORT_CREATED]: "auditActionDataExportCreated",
  [AUDIT_ACTIONS.USER_CREATED]: "auditActionUserCreated",
  [AUDIT_ACTIONS.USER_UPDATED]: "auditActionUserUpdated",
  [AUDIT_ACTIONS.USER_ACTIVATED]: "auditActionUserActivated",
  [AUDIT_ACTIONS.USER_DEACTIVATED]: "auditActionUserDeactivated",
} as const satisfies Record<AuditAction, keyof DashboardStrings>;

export interface AuditActivityEntry {
  id: string;
  actionLabel: string;
  actorName: string | null;
  createdAt: Date;
  metadataSummary: string | null;
}

export interface AuditActivityPage {
  entries: AuditActivityEntry[];
  nextCursor: string | null;
}

export function getAuditActionLabel(
  action: string,
  lang: AppLanguage
): string {
  const t = DASHBOARD_STRINGS[lang];
  const labelKey = AUDIT_ACTION_LABEL_KEYS[action as AuditAction];
  return labelKey ? t[labelKey] : t.auditActivityUnknownAction;
}

function isDashboardKpiKey(value: unknown): value is DashboardKpiKey {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(KPI_LABELS_EN, value)
  );
}

function kpiLabels(value: unknown, lang: AppLanguage): string[] {
  if (!Array.isArray(value)) return [];
  const labels = value
    .filter(isDashboardKpiKey)
    .map((key) => getAdminKpiTitle(key));
  return [...new Set(labels)];
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0
    ? value
    : null;
}

function summarizeMetadata(
  action: string,
  metadata: AuditLog["metadata"],
  lang: AppLanguage
): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const t = DASHBOARD_STRINGS[lang];

  switch (action) {
    case AUDIT_ACTIONS.PACKAGE_ASSIGNED: {
      const previousPackageId = stringValue(metadata.previousPackageId);
      const packageId = stringValue(metadata.packageId);
      if (previousPackageId && packageId) {
        return t.auditActivityMetadataPackageReassigned;
      }
      if (packageId) return t.auditActivityMetadataPackageAssigned;
      return t.auditActivityMetadataPackageChanged;
    }
    case AUDIT_ACTIONS.PRICING_RULE_CREATED: {
      const [metric] = kpiLabels(metadata.metric, lang);
      return metric
        ? tpl(t.auditActivityMetadataPricingRuleCreated, { metric })
        : t.auditActivityMetadataPricingRuleCreatedGeneric;
    }
    case AUDIT_ACTIONS.KPI_CONFIG_CHANGED: {
      const labels = kpiLabels(metadata.visibleMetrics, lang);
      return labels.length > 0
        ? tpl(t.auditActivityMetadataKpiConfigChanged, {
            kpis: labels.join(lang === "fa" ? "، " : ", "),
          })
        : t.auditActivityMetadataKpiConfigChangedGeneric;
    }
    case AUDIT_ACTIONS.CLIENT_CREATED: {
      const name = stringValue(metadata.name);
      return name
        ? tpl(t.auditActivityMetadataClientCreated, { name })
        : t.auditActivityMetadataClientCreatedGeneric;
    }
    case AUDIT_ACTIONS.CLIENT_UPDATED: {
      const name = stringValue(metadata.name);
      const previousName = stringValue(metadata.previousName);
      if (name && previousName && name !== previousName) {
        return tpl(t.auditActivityMetadataClientRenamed, {
          name,
          previousName,
        });
      }
      if (
        typeof metadata.isActive === "boolean" &&
        typeof metadata.previousIsActive === "boolean" &&
        metadata.isActive !== metadata.previousIsActive
      ) {
        return tpl(t.auditActivityMetadataClientStatusChanged, {
          status: metadata.isActive ? t.clientActive : t.clientInactive,
        });
      }
      return t.auditActivityMetadataClientUpdated;
    }
    case AUDIT_ACTIONS.CLIENT_DEACTIVATED: {
      const name = stringValue(metadata.name);
      return name
        ? tpl(t.auditActivityMetadataClientDeactivated, { name })
        : t.auditActivityMetadataClientDeactivatedGeneric;
    }
    case AUDIT_ACTIONS.DATA_EXPORT_CREATED: {
      const rangeDays = nonNegativeInteger(metadata.rangeDays);
      const rowCount = nonNegativeInteger(metadata.rowCount);
      if (rangeDays !== null && rowCount !== null) {
        return tpl(t.auditActivityMetadataDataExportCreated, {
          range: rangeDays,
          rows: rowCount,
        });
      }
      return null;
    }
    default:
      return null;
  }
}

export async function getClientAuditActivity(
  user: Pick<User, "role" | "id" | "clientId">,
  clientId: string,
  lang: AppLanguage,
  page: PageRequest = { limit: AUDIT_ACTIVITY_PAGE_SIZE },
  db?: Db
): Promise<AuditActivityPage> {
  await requireClientAccess(user, clientId, db);

  const requestedLimit =
    Number.isInteger(page.limit) && page.limit > 0
      ? Math.min(page.limit, MAX_AUDIT_ACTIVITY_PAGE_SIZE)
      : AUDIT_ACTIVITY_PAGE_SIZE;
  const request: PageRequest = {
    limit: requestedLimit,
    ...(page.cursor ? { cursor: page.cursor } : {}),
  };

  const { auditLogRepository, userRepository } = getRepositories(db);
  const result = await auditLogRepository.findByTarget(
    AUDIT_TARGET_TYPES.CLIENT,
    clientId,
    request
  );

  const actorIds = [...new Set(result.items.map((entry) => entry.actorUserId))];
  const actors = await Promise.all(actorIds.map((id) => userRepository.findById(id)));
  const actorNames = new Map<string, string | null>();
  actors.forEach((actor, index) => {
    const name = actor?.fullName.trim();
    actorNames.set(actorIds[index], name || null);
  });

  return {
    entries: result.items.map((entry) => ({
      id: entry.id,
      actionLabel: getAuditActionLabel(entry.action, lang),
      actorName: actorNames.get(entry.actorUserId) ?? null,
      createdAt: entry.createdAt,
      metadataSummary: summarizeMetadata(entry.action, entry.metadata, lang),
    })),
    nextCursor: result.nextCursor,
  };
}
