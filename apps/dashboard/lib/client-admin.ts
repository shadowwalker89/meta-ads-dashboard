import { SqlitePackageEnforcement } from "@repo/database";
import type { AdAccount, Client, Package, User } from "@repo/shared";
import { sqliteAuditService } from "@/lib/audit";
import { getDatabase, getRepositories } from "@/lib/db";
import { accessibleClientIds, requireClientAccess, requireRole } from "@/lib/access";

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
  isActive: boolean;
  adAccountCount: number;
  createdAt: Date;
}

export async function getClientAdminData(
  user: Pick<User, "role" | "id" | "clientId">,
  db: Db = getDatabase()
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
      isActive: client.isActive,
      adAccountCount: adAccounts.length,
      createdAt: client.createdAt,
    });
  }

  const packages = await packageRepository.listAll();
  const packageById = new Map(packages.map((p) => [p.id, p]));
  for (const client of clients) {
    const clientRow = await clientRepository.findById(client.id);
    client.packageName = clientRow ? (packageById.get(clientRow.packageId)?.name ?? null) : null;
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
  db: Db = getDatabase()
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
}

export async function runCreateClient(
  user: Pick<User, "role" | "id" | "clientId">,
  input: CreateClientInput,
  db: Db = getDatabase()
): Promise<ActionResult<Client>> {
  try {
    assertCanCreateClients(user);
    const created = await getRepositories(db).clientRepository.create({
      name: input.name,
      businessType: input.businessType,
      contactEmail: input.contactEmail,
      packageId: input.packageId,
      isActive: true,
    });
    await sqliteAuditService(db).recordClientCreated(user, created);
    return { ok: true, value: created };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function runDeactivateClient(
  user: Pick<User, "role" | "id" | "clientId">,
  clientId: string,
  db: Db = getDatabase()
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
    await sqliteAuditService(db).recordClientDeactivated(user, deactivated);
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
  db: Db = getDatabase()
): Promise<ActionResult<AdAccount>> {
  try {
    requireRole(user, "admin", "super_admin");
    await requireClientAccess(user, input.clientId, db);
    // PackageEnforcement is a service (not a repository) and keeps its
    // direct database-handle contract — deliberately not in the bundle.
    await new SqlitePackageEnforcement(db).assertCanCreateAdAccount(input.clientId);
    const created = await getRepositories(db).adAccountRepository.create(input);
    await sqliteAuditService(db).recordAdAccountCreated(user, created);
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
  db: Db = getDatabase()
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
    await sqliteAuditService(db).recordAdAccountSourceUpdated(user, updated, {
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
  db: Db = getDatabase()
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
    await sqliteAuditService(db).recordAdAccountStatusUpdated(user, updated, existing.status);
    return { ok: true, value: updated };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}