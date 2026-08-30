import { createRepositoryPackageAssignmentService } from "@repo/database";
import type { Package, User } from "@repo/shared";
import { sqliteAuditService } from "@/lib/audit";
import { getDatabase, getRepositories } from "@/lib/db";
import type { PackageSettingsInput } from "@/lib/package-settings-input";

export type { PackageSettingsInput } from "@/lib/package-settings-input";
export { toPackageSettingsInput } from "@/lib/package-settings-input";

/**
 * Server-only. Super Admin package management + client package assignment.
 *
 * This is the thin application layer between the admin UI and the storage
 * boundary:
 *
 *   - Authorization is a single pure rule: only super_admin may manage
 *     packages or assign them. The web layer resolves the current user;
 *     this module only checks the role policy.
 *   - Package CRUD goes through the existing typed repository, which
 *     sanitizes settings via the shared domain helpers
 *     (sanitizePackageDefaultKpis / sanitizePackageFeatures /
 *     sanitizePackagePricingDefaults) and validates isValidPackageSettings.
 *     No tier logic is hard-coded here — tiers are data rows.
 *   - Package ASSIGNMENT goes exclusively through
 *     PackageAssignmentService.assignPackage(). This module never
 *     reproduces assignment/propagation orchestration.
 *   - Data loaders accept an optional database handle so tests can run
 *     against an in-memory database; the server actions pass getDatabase().
 *
 * There is deliberately no package deletion: no safe lifecycle/deactivation
 * model exists for packages yet.
 */

type Db = ReturnType<typeof getDatabase>;

export type ActionResult<T> = { ok: true; value: T } | { ok: false; error: string };

export interface AssignActionOutput {
  packageId: string;
  packageAssignedAt: Date;
  changed: boolean;
  pricingRulesCreated: number;
}

export function canManagePackages(user: Pick<User, "role"> | null): boolean {
  return user?.role === "super_admin";
}

export function assertCanManagePackages(user: Pick<User, "role">): void {
  if (!canManagePackages(user)) {
    throw new Error("فقط مدیر کل می‌تواند پکیج‌ها را مدیریت کند.");
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "خطای ناشناخته رخ داد.";
}

// --- Data loaders ---------------------------------------------------------

export async function getPackageManagementData(
  db: Db = getDatabase()
): Promise<Package[]> {
  return getRepositories(db).packageRepository.listAll();
}

export interface ClientAssignmentEntry {
  id: string;
  name: string;
  packageId: string | null;
  /** Current package display name; null when the client has no package. */
  packageName: string | null;
  packageAssignedAt: Date | null;
}

export async function getClientAssignmentData(db: Db = getDatabase()): Promise<{
  clients: ClientAssignmentEntry[];
  packages: Package[];
}> {
  const { clientRepository, packageRepository } = getRepositories(db);
  const packages = await packageRepository.listAll();
  const packageById = new Map(packages.map((p) => [p.id, p]));

  const page = await clientRepository.list({ limit: 1000 });
  const clients: ClientAssignmentEntry[] = page.items.map((client) => {
    const pkg = packageById.get(client.packageId);
    return {
      id: client.id,
      name: client.name,
      packageId: client.packageId,
      packageName: pkg?.name ?? null,
      packageAssignedAt: client.packageAssignedAt,
    };
  });

  return { clients, packages };
}

// --- Action runners (authorization + single business entry point) ---------

export async function runCreatePackage(
  user: Pick<User, "role" | "id">,
  input: PackageSettingsInput,
  db: Db = getDatabase()
): Promise<ActionResult<Package>> {
  try {
    assertCanManagePackages(user);
    const created = await getRepositories(db).packageRepository.create({
      ...input,
      metricThresholds: {},
    });
    await sqliteAuditService(db).recordPackageCreated(user, created);
    return { ok: true, value: created };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function runUpdatePackage(
  user: Pick<User, "role" | "id">,
  packageId: string,
  input: PackageSettingsInput,
  db: Db = getDatabase()
): Promise<ActionResult<Package>> {
  try {
    assertCanManagePackages(user);
    const updated = await getRepositories(db).packageRepository.update(packageId, input);
    await sqliteAuditService(db).recordPackageUpdated(user, updated.id, updated);
    return { ok: true, value: updated };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export interface RunAssignPackageDeps {
  db?: Db;
  assignmentService?: {
    assignPackage(input: { actorRole: string; clientId: string; packageId: string }): Promise<{ changed: boolean; packageId: string; packageAssignedAt: Date; pricingRulesCreated: number }>;
  };
}

/**
 * The ONLY application entry point for assigning a package to a client.
 * Authorization first, then delegation to the provider-neutral
 * RepositoryPackageAssignmentService — no repository orchestration lives
 * here or in the UI. The service is injectable so tests can prove the
 * action path calls it (and assert what it was called with).
 */
export async function runAssignPackage(
  user: Pick<User, "role" | "id">,
  clientId: string,
  packageId: string,
  deps: RunAssignPackageDeps = {}
): Promise<ActionResult<AssignActionOutput>> {
  try {
    assertCanManagePackages(user);
    const db = deps.db ?? getDatabase();
    const repos = getRepositories(db);
    const previousPackageId =
      (await repos.clientRepository.findById(clientId))?.packageId ?? null;
    const service =
      deps.assignmentService ??
      createRepositoryPackageAssignmentService(
        repos.clientRepository,
        repos.packageRepository,
        repos.pricingRuleRepository
      );
    const result = await service.assignPackage({
      actorRole: user.role,
      clientId,
      packageId,
    });
    if (result.changed) {
      await sqliteAuditService(db).recordPackageAssigned(
        user,
        clientId,
        previousPackageId,
        result.packageId
      );
    }
    return {
      ok: true,
      value: {
        packageId: result.packageId,
        packageAssignedAt: result.packageAssignedAt,
        changed: result.changed,
        pricingRulesCreated: result.pricingRulesCreated,
      },
    };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}