import { PackageEnforcement } from "@repo/database";
import type { AdAccount, Client, Package, User } from "@repo/shared";
import { getAuditService } from "@/lib/audit";
import { getDatabase, getRepositories } from "@/lib/db";
import { accessibleClientIds, requireClientAccess, requireRole } from "@/lib/access";
import { runAssignPackage } from "@/lib/package-admin";
import { DASHBOARD_STRINGS, type AppLanguage } from "@/lib/i18n/strings";

/**
 * Server-only. Client + AdAccount management.
 *
 * This is the thin application layer between the admin UI and the storage
 * boundary, mirroring lib/package-admin.ts:
 *
 *   - Authorization composes two rules:
 *       • Viewing clients and managing their ad accounts: super_admin (any
 *         client) and admin (only clients in AdminAssignment) — enforced
 *         through the central tenant boundary (accessibleClientIds /
 *         requireClientAccess).
 *       • Creating and deactivating clients: super_admin only — this is a
 *         global lifecycle operation, not an assigned-client operation.
 *   - Client CRUD goes through the existing typed repository. AdAccount
 *     creation additionally passes through SqlitePackageEnforcement so
 *     Package.maxAdAccounts is honored at the business layer — never just
 *     in the UI.
 *   - Every mutation records an audit entry AFTER the underlying operation
 *     succeeded, so a failed operation never produces a success audit.
 *   - Data loaders accept an optional database handle so tests can run
 *     against an in-memory database; the server actions pass getDatabase().
 *
 * There is deliberately no client delete: no safe lifecycle model exists
 * yet. Deactivation (is_active = 0) is the supported off-ramp.
 */

type Db = ReturnType<typeof getDatabase>;

export type ActionResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Who may view clients and manage their ad accounts (tenant-scoped). */
export function canManageClients(user: Pick<User, "role"> | null): boolean {
  return user?.role === "admin" || user?.role === "super_admin";
}

/** Who may create/deactivate clients at all (global lifecycle operation). */
export function canCreateClients(user: Pick<User, "role"> | null): boolean {
  return user?.role === "super_admin";
}

export function assertCanCreateClients(user: Pick<User, "role">): void {
  if (!canCreateClients(user)) {
    throw new Error("فقط مدیر کل می‌تواند مشتری جدید ایجاد یا غیرفعال کند.");
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "خطای ناشناخته رخ داد.";
}

// --- Data loaders ---------------------------------------------------------

export interface ClientAdminEntry {
  id: string;
  name: string;
  businessType: string;
  contactEmail: string;
  packageName: string | null;
  packageId: string;
  isActive: boolean;
  adAccountCount: number;
  createdAt: Date;
}

export async function getClientAdminData(
  user: Pick<User, "role" | "id" | "clientId">,
  db?: Db
): Promise<{
  clients: ClientAdminEntry[];
  packages: Package[];
}> {
  const { adAccountRepository, clientRepository, packageRepository } =
    getRepositories(db);
  const clientIds = await accessibleClientIds(user, db);

  const clients: ClientAdminEntry[] = [];
  for (const clientId of clientIds) {
    const client = await clientRepository.findById(clientId);
    if (!client) continue;
    const adAccounts = await adAccountRepository.findByClient(clientId);
    clients.push({
      id: client.id,
      name: client.name,
      businessType: client.businessType,
      contactEmail: client.contactEmail,
      packageName: null, // resolved below
      packageId: client.packageId,
      isActive: client.isActive,
      adAccountCount: adAccounts.length,
      createdAt: client.createdAt,
    });
  }

  const packages = await packageRepository.listAll();
  const packageById = new Map(packages.map((p) => [p.id, p]));
  for (const client of clients) {
    const clientRow = await clientRepository.findById(client.id);
    client.packageName = clientRow
      ? (packageById.get(clientRow.packageId)?.name ?? null)
      : null;
    client.packageId = clientRow?.packageId ?? "";
  }

  return { clients, packages };
}

export interface AdAccountAdminData {
  client: Client;
  adAccounts: AdAccount[];
  package: Package | null;
}

export async function getAdAccountAdminData(
  user: Pick<User, "role" | "id" | "clientId">,
  clientId: string,
  db?: Db
): Promise<AdAccountAdminData> {
  await requireClientAccess(user, clientId, db);
  const { adAccountRepository, clientRepository, packageRepository } =
    getRepositories(db);
  const client = await clientRepository.findById(clientId);
  if (!client) {
    throw new Error(`مشتری یافت نشد: ${clientId}`);
  }
  const adAccounts = await adAccountRepository.findByClient(clientId);
  const pkg = await packageRepository.findById(client.packageId);
  return { client, adAccounts, package: pkg };
}

// --- Action runners (authorization + single business entry point) ---------

export interface CreateClientInput {
  name: string;
  businessType: string;
  contactEmail: string;
  packageId: string;
  isActive?: boolean;
}

async function validateClientInput(input: CreateClientInput, db: Db | undefined, lang: AppLanguage) {
  const t = DASHBOARD_STRINGS[lang];
  if (
    typeof input.name !== "string" || !input.name.trim() ||
    typeof input.businessType !== "string" || !input.businessType.trim() ||
    typeof input.contactEmail !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contactEmail.trim()) ||
    typeof input.packageId !== "string" || !input.packageId.trim() ||
    (input.isActive !== undefined && typeof input.isActive !== "boolean")
  ) {
    throw new Error(t.clientInvalidInput);
  }
  if (!(await getRepositories(db).packageRepository.findById(input.packageId))) {
    throw new Error(t.clientInvalidPackage);
  }
  return {
    name: input.name.trim(),
    businessType: input.businessType.trim(),
    contactEmail: input.contactEmail.trim(),
    packageId: input.packageId,
    isActive: input.isActive ?? true,
  };
}

export async function runCreateClient(
  user: Pick<User, "role" | "id" | "clientId">,
  input: CreateClientInput,
  db?: Db,
  lang: AppLanguage = "fa"
): Promise<ActionResult<Client>> {
  try {
    assertCanCreateClients(user);
    const validated = await validateClientInput(input, db, lang);
    const created = await getRepositories(db).clientRepository.create(validated);
    await getAuditService(db).recordClientCreated(user, created);
    return { ok: true, value: created };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export interface UpdateClientInput {
  name: string;
  businessType: string;
  contactEmail: string;
  isActive: boolean;
  packageId: string;
}

/**
 * Edits an existing client without changing its identity. The client id
 * is preserved — this is an UPDATE, never delete-and-recreate.
 *
 * Authorization composes the two existing rules:
 *   - Basic profile fields (name, business type, contact email): any
 *     manager of that client (admin → assigned clients via the central
 *     tenant boundary, super_admin → any).
 *   - Status/package changes: super_admin only — global lifecycle and
 *     package-assignment decisions, consistent with
 *     assertCanCreateClients / the package-assignment service's own
 *     super_admin gate.
 *
 * A package change goes through the EXISTING
 * RepositoryPackageAssignmentService (via runAssignPackage) so pricing
 * propagation and audit semantics stay identical to the standalone
 * assignment workflow — no duplicate orchestration, no pricing changes.
 */
export async function runUpdateClient(
  user: Pick<User, "role" | "id" | "clientId">,
  clientId: string,
  input: UpdateClientInput,
  db?: Db,
  lang: AppLanguage = "fa"
): Promise<ActionResult<Client>> {
  try {
    requireRole(user, "admin", "super_admin");
    await requireClientAccess(user, clientId, db);
    const repos = getRepositories(db);
    const existing = await repos.clientRepository.findById(clientId);
    if (!existing) {
      throw new Error(`مشتری یافت نشد: ${clientId}`);
    }

    const validated = await validateClientInput(input, db, lang);
    if (
      validated.isActive !== existing.isActive ||
      validated.packageId !== existing.packageId
    ) {
      assertCanCreateClients(user);
    }

    if (validated.packageId !== existing.packageId) {
      const assignment = await runAssignPackage(
        user,
        clientId,
        validated.packageId,
        { db }
      );
      if (!assignment.ok) {
        throw new Error(assignment.error);
      }
    }

    const updated = await repos.clientRepository.update(clientId, {
      name: validated.name,
      businessType: validated.businessType,
      contactEmail: validated.contactEmail,
      isActive: validated.isActive,
    });

    if (
      existing.isActive !== updated.isActive ||
      existing.name !== updated.name ||
      existing.businessType !== updated.businessType ||
      existing.contactEmail !== updated.contactEmail
    ) {
      await getAuditService(db).recordClientUpdated(user, updated, existing);
    }

    return { ok: true, value: updated };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function runDeactivateClient(
  user: Pick<User, "role" | "id" | "clientId">,
  clientId: string,
  db?: Db
): Promise<ActionResult<Client>> {
  try {
    assertCanCreateClients(user);
    const repo = getRepositories(db).clientRepository;
    const existing = await repo.findById(clientId);
    if (!existing) {
      throw new Error(`مشتری یافت نشد: ${clientId}`);
    }
    if (!existing.isActive) {
      throw new Error("مشتری از قبل غیرفعال است.");
    }
    await repo.deactivate(clientId);
    const deactivated = await repo.findById(clientId);
    if (!deactivated) {
      throw new Error(`مشتری یافت نشد: ${clientId}`);
    }
    await getAuditService(db).recordClientDeactivated(user, deactivated);
    return { ok: true, value: deactivated };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export interface CreateAdAccountInput {
  clientId: string;
  name: string;
  status: AdAccount["status"];
  source: AdAccount["source"];
  metaAdAccountId: string | null;
}

export async function runCreateAdAccount(
  user: Pick<User, "role" | "id" | "clientId">,
  input: CreateAdAccountInput,
  db?: Db
): Promise<ActionResult<AdAccount>> {
  try {
    requireRole(user, "admin", "super_admin");
    await requireClientAccess(user, input.clientId, db);
    const repos = getRepositories(db);
    const enforcement = new PackageEnforcement(
      repos.clientRepository,
      repos.packageRepository,
      repos.adAccountRepository,
      repos.campaignRepository
    );
    await enforcement.assertCanCreateAdAccount(input.clientId);
    const created = await repos.adAccountRepository.create(input);
    await getAuditService(db).recordAdAccountCreated(user, created);
    return { ok: true, value: created };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function runUpdateAdAccountSource(
  user: Pick<User, "role" | "id" | "clientId">,
  adAccountId: string,
  source: AdAccount["source"],
  metaAdAccountId: string | null,
  db?: Db
): Promise<ActionResult<AdAccount>> {
  try {
    requireRole(user, "admin", "super_admin");
    const repo = getRepositories(db).adAccountRepository;
    const existing = await repo.findById(adAccountId);
    if (!existing) {
      throw new Error(`اکانت تبلیغاتی یافت نشد: ${adAccountId}`);
    }
    await requireClientAccess(user, existing.clientId, db);
    const updated = await repo.updateSource(adAccountId, source, metaAdAccountId);
    await getAuditService(db).recordAdAccountSourceUpdated(user, updated, {
      source: existing.source,
      metaAdAccountId: existing.metaAdAccountId,
    });
    return { ok: true, value: updated };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function runUpdateAdAccountStatus(
  user: Pick<User, "role" | "id" | "clientId">,
  adAccountId: string,
  status: AdAccount["status"],
  db?: Db
): Promise<ActionResult<AdAccount>> {
  try {
    requireRole(user, "admin", "super_admin");
    const repo = getRepositories(db).adAccountRepository;
    const existing = await repo.findById(adAccountId);
    if (!existing) {
      throw new Error(`اکانت تبلیغاتی یافت نشد: ${adAccountId}`);
    }
    await requireClientAccess(user, existing.clientId, db);
    const updated = await repo.updateStatus(adAccountId, status);
    await getAuditService(db).recordAdAccountStatusUpdated(user, updated, existing.status);
    return { ok: true, value: updated };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}