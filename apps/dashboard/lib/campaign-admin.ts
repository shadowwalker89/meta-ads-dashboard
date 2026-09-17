import type { CampaignAssignment, User } from "@repo/shared";
import { getAuditService } from "@/lib/audit";
import { getDatabase, getRepositories } from "@/lib/db";
import {
  accessibleClientIds,
  requireClientAccess,
} from "@/lib/access";
import { getEffectiveClientIdForCampaign } from "@/lib/campaign-ownership";

/**
 * Server-only. Campaign ownership / assignment management.
 *
 * This is the thin application layer between the admin UI and the storage
 * boundary, mirroring lib/client-admin.ts:
 *
 *   - Authorization composes two rules, both enforced server-side:
 *       • Only admin / super_admin may change campaign ownership. A client
 *         user can never mutate an assignment (role gate).
 *       • The actor must be able to reach BOTH the campaign's current
 *         effective client AND the target client through the central
 *         tenant boundary (requireClientAccess). An admin therefore can
 *         never move a campaign out of, or into, a client they do not
 *         manage — the request input is never trusted.
 *   - Ownership itself is NOT re-derived here: the read path reuses the
 *     single provider-neutral resolver (campaign-ownership.ts) and the
 *     repositories' findByClient semantics.
 *   - The database enforces at most one ACTIVE assignment per campaign
 *     (partial unique index). The lifecycle keeps that invariant by
 *     deactivating the previous active row BEFORE inserting the new one,
 *     and by mapping a raw uniqueness violation to a controlled message
 *     instead of crashing. Historical rows are never deleted.
 *   - Every mutation records an audit entry AFTER the operation succeeded.
 *   - Data loaders accept an optional database handle so tests can run
 *     against an in-memory database; the server actions pass getDatabase().
 */

type Db = ReturnType<typeof getDatabase>;
type Repos = ReturnType<typeof getRepositories>;

export type ActionResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

const MANAGE_FORBIDDEN =
  "فقط مدیر و مدیر کل می‌توانند مالکیت کمپین را تغییر دهند.";
const CAMPAIGN_NOT_FOUND = "کمپین یافت نشد.";
const CLIENT_NOT_FOUND = "مشتری یافت نشد.";
const ASSIGNMENT_ALREADY_EXISTS =
  "این کمپین از قبل به همین مشتری اختصاص یافته است.";
const NO_ACTIVE_ASSIGNMENT = "این کمپین هیچ انتساب فعالی ندارد.";
const NO_OWNERSHIP =
  "مالکیت این کمپین قابل تعیین نیست؛ فقط مدیر کل می‌تواند آن را تغییر دهد.";
const DUPLICATE_ACTIVE_ASSIGNMENT =
  "این کمپین از قبل یک انتساب فعال دارد؛ لطفاً دوباره تلاش کنید.";
const EMPTY_INPUT = "ورودی نامعتبر است.";

/** Who may change campaign ownership at all. */
export function canManageCampaignOwnership(
  user: Pick<User, "role"> | null
): boolean {
  return user?.role === "admin" || user?.role === "super_admin";
}

export function assertCanManageCampaignOwnership(
  user: Pick<User, "role">
): void {
  if (!canManageCampaignOwnership(user)) {
    throw new Error(MANAGE_FORBIDDEN);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "خطای ناشناخته رخ داد.";
}

/**
 * True when an error is a unique-index violation. PostgreSQL surfaces
 * 23505; better-sqlite3 surfaces SQLITE_CONSTRAINT_UNIQUE. Message
 * matching is the fallback for driver versions that omit the code.
 */
function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: unknown }).code;
  if (code === "23505" || code === "SQLITE_CONSTRAINT_UNIQUE") {
    return true;
  }
  return /unique constraint|UNIQUE constraint failed/i.test(error.message);
}

// --- Data loaders ---------------------------------------------------------

export interface CampaignClientOption {
  id: string;
  name: string;
}

/** The active assignment, resolved for display. */
export interface CampaignAssignmentView {
  id: string;
  clientId: string;
  clientName: string | null;
  assignedAt: Date;
}

export interface CampaignAdminEntry {
  id: string;
  name: string;
  status: string;
  adAccountId: string;
  adAccountName: string;
  /** Client that owns the campaign through its AdAccount. */
  inheritedClientId: string;
  inheritedClientName: string | null;
  /** Active explicit assignment, or null when ownership is inherited. */
  activeAssignment: CampaignAssignmentView | null;
  /** The client the campaign currently belongs to. */
  effectiveClientId: string;
  effectiveClientName: string | null;
  /** "assigned" when an active assignment exists, else "inherited". */
  ownership: "assigned" | "inherited";
}

export interface CampaignAdminData {
  clients: CampaignClientOption[];
  selectedClientId: string | null;
  selectedClientName: string | null;
  campaigns: CampaignAdminEntry[];
}

async function resolveClientNames(
  repos: Repos,
  clientIds: readonly string[]
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  for (const clientId of clientIds) {
    const client = await repos.clientRepository.findById(clientId);
    if (client) {
      names.set(client.id, client.name);
    }
  }
  return names;
}

/**
 * Authorized read path for the Campaign Ownership page. The requested
 * clientId arrives from request input and is NEVER trusted: it must match
 * an accessible client, and every read passes through the central tenant
 * boundary before any campaign is loaded.
 */
export async function getCampaignAdminData(
  user: Pick<User, "role" | "id" | "clientId">,
  requestedClientId: string | null,
  db?: Db
): Promise<CampaignAdminData> {
  const repos = getRepositories(db);
  const accessibleIds = await accessibleClientIds(user, db);
  const accessibleNames = await resolveClientNames(repos, accessibleIds);

  const clients: CampaignClientOption[] = accessibleIds
    .filter((id) => accessibleNames.has(id))
    .map((id) => ({ id, name: accessibleNames.get(id) ?? "" }));

  const selectedClientId =
    requestedClientId !== null && accessibleNames.has(requestedClientId)
      ? requestedClientId
      : null;

  if (selectedClientId === null) {
    return {
      clients,
      selectedClientId: null,
      selectedClientName: null,
      campaigns: [],
    };
  }

  await requireClientAccess(user, selectedClientId, db);
  const campaigns = await repos.campaignRepository.findByClient(selectedClientId);

  const entries: CampaignAdminEntry[] = [];
  for (const campaign of campaigns) {
    const assignment =
      await repos.campaignAssignmentRepository.findActiveByCampaign(campaign.id);
    const adAccount = await repos.adAccountRepository.findById(campaign.adAccountId);
    const inheritedClientId = adAccount?.clientId ?? "";
    const effectiveClientId = assignment?.clientId ?? inheritedClientId;

    entries.push({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      adAccountId: campaign.adAccountId,
      adAccountName: adAccount?.name ?? "—",
      inheritedClientId,
      inheritedClientName: accessibleNames.get(inheritedClientId) ?? null,
      activeAssignment: assignment
        ? {
            id: assignment.id,
            clientId: assignment.clientId,
            clientName: accessibleNames.get(assignment.clientId) ?? null,
            assignedAt: assignment.assignedAt,
          }
        : null,
      effectiveClientId,
      effectiveClientName: accessibleNames.get(effectiveClientId) ?? null,
      ownership: assignment ? "assigned" : "inherited",
    });
  }

  return {
    clients,
    selectedClientId,
    selectedClientName: accessibleNames.get(selectedClientId) ?? null,
    campaigns: entries,
  };
}

// --- Action runners (authorization + single business entry point) ---------

export interface AssignCampaignResult {
  campaignId: string;
  clientId: string;
  assignmentId: string;
  /** True when an existing active assignment was replaced. */
  changed: boolean;
  previousClientId: string | null;
}

/**
 * The ONLY application entry point for creating or changing a campaign's
 * explicit client assignment.
 *
 * Invariants:
 *   - the actor may reach the campaign's current effective client and the
 *     target client (no cross-client escalation);
 *   - an active assignment to the same client is rejected rather than
 *     silently duplicated;
 *   - the previous active row is deactivated before the new one is
 *     inserted, so the partial unique index is never violated;
 *   - history is preserved (deactivate, never delete).
 */
export async function runAssignCampaignToClient(
  user: Pick<User, "role" | "id" | "clientId">,
  campaignId: string,
  targetClientId: string,
  db?: Db
): Promise<ActionResult<AssignCampaignResult>> {
  try {
    assertCanManageCampaignOwnership(user);
    if (!campaignId || !targetClientId) {
      throw new Error(EMPTY_INPUT);
    }

    const repos = getRepositories(db);
    const campaign = await repos.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new Error(CAMPAIGN_NOT_FOUND);
    }
    const targetClient = await repos.clientRepository.findById(targetClientId);
    if (!targetClient) {
      throw new Error(CLIENT_NOT_FOUND);
    }
    await requireClientAccess(user, targetClientId, db);

    const currentEffectiveClientId = await getEffectiveClientIdForCampaign(
      campaignId,
      db
    );
    if (currentEffectiveClientId === null) {
      if (user.role !== "super_admin") {
        throw new Error(NO_OWNERSHIP);
      }
    } else {
      await requireClientAccess(user, currentEffectiveClientId, db);
    }

    const active =
      await repos.campaignAssignmentRepository.findActiveByCampaign(campaignId);
    if (active && active.clientId === targetClientId) {
      throw new Error(ASSIGNMENT_ALREADY_EXISTS);
    }

    const previousClientId = active?.clientId ?? null;
    if (active) {
      await repos.campaignAssignmentRepository.deactivate(active.id);
    }

    let created: CampaignAssignment;
    try {
      created = await repos.campaignAssignmentRepository.create({
        campaignId,
        clientId: targetClientId,
        assignedBy: user.id,
        assignedAt: new Date(),
        isActive: true,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new Error(DUPLICATE_ACTIVE_ASSIGNMENT);
      }
      throw error;
    }

    if (previousClientId === null) {
      await getAuditService(db).recordCampaignAssigned(user, {
        campaignId,
        clientId: targetClientId,
      });
    } else {
      await getAuditService(db).recordCampaignAssignmentChanged(
        user,
        { campaignId, clientId: previousClientId },
        { clientId: targetClientId }
      );
    }

    return {
      ok: true,
      value: {
        campaignId,
        clientId: targetClientId,
        assignmentId: created.id,
        changed: previousClientId !== null,
        previousClientId,
      },
    };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export interface DeactivateCampaignResult {
  campaignId: string;
  /** The client the campaign was explicitly assigned to. */
  clientId: string;
}

/**
 * Deactivates the campaign's active assignment, restoring natural
 * ownership. The row is never deleted — historical assignments stay in
 * the database with is_active = false.
 */
export async function runDeactivateCampaignAssignment(
  user: Pick<User, "role" | "id" | "clientId">,
  campaignId: string,
  db?: Db
): Promise<ActionResult<DeactivateCampaignResult>> {
  try {
    assertCanManageCampaignOwnership(user);
    if (!campaignId) {
      throw new Error(EMPTY_INPUT);
    }

    const repos = getRepositories(db);
    const campaign = await repos.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new Error(CAMPAIGN_NOT_FOUND);
    }

    const effectiveClientId = await getEffectiveClientIdForCampaign(campaignId, db);
    if (effectiveClientId === null) {
      if (user.role !== "super_admin") {
        throw new Error(NO_OWNERSHIP);
      }
    } else {
      await requireClientAccess(user, effectiveClientId, db);
    }

    const active =
      await repos.campaignAssignmentRepository.findActiveByCampaign(campaignId);
    if (!active) {
      throw new Error(NO_ACTIVE_ASSIGNMENT);
    }

    await repos.campaignAssignmentRepository.deactivate(active.id);
    await getAuditService(db).recordCampaignAssignmentDeactivated(user, {
      campaignId,
      clientId: active.clientId,
    });

    return {
      ok: true,
      value: { campaignId, clientId: active.clientId },
    };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}