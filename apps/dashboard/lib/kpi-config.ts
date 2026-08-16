import {
  SqliteClientRepository,
  SqliteDashboardPreferenceRepository,
} from "@repo/database";
import { sqliteAuditService } from "@/lib/audit";
import { getDatabase } from "@/lib/db";
import {
  accessibleClientIds,
  requireClientAccess,
  requireRole,
} from "@/lib/access";
import { getClientPackageSettings } from "@/lib/package-settings";
import type { DashboardKpiKey, User } from "@repo/shared";
import { sanitizeDashboardKpiKeys } from "@repo/shared";

type Db = ReturnType<typeof getDatabase>;

export type SaveKpiConfigResult =
  | { ok: true; savedKeys: DashboardKpiKey[] }
  | { ok: false; error: string };

function kpiKeySetEqual(
  a: readonly DashboardKpiKey[],
  b: readonly DashboardKpiKey[]
): boolean {
  const sorted = (keys: readonly DashboardKpiKey[]) => [...keys].sort();
  const sa = sorted(a);
  const sb = sorted(b);
  return sa.length === sb.length && sa.every((key, i) => key === sb[i]);
}

/**
 * The ONLY application entry point for saving a client's visible KPI
 * set. Enforces the central tenant-access boundary (admin → assigned
 * clients only, super_admin → any), persists via the existing
 * preference repository, and records an audit entry ONLY when the
 * effective configuration actually changed — re-saving the same set is
 * a silent no-op for the audit trail. Audit runs only after the save
 * succeeded, so a failed save never produces a success audit record.
 */
export async function runSaveClientKpiConfig(
  user: Pick<User, "role" | "id" | "clientId">,
  clientId: string,
  keys: readonly unknown[],
  db: Db = getDatabase()
): Promise<SaveKpiConfigResult> {
  try {
    requireRole(user, "admin", "super_admin");
    await requireClientAccess(user, clientId, db);
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "شما اجازه‌ی انجام این کار را ندارید.",
    };
  }

  const sanitized = sanitizeDashboardKpiKeys(keys);
  const repo = new SqliteDashboardPreferenceRepository(db);
  const existing = await repo.findForClient(clientId);
  const previous = existing?.visibleMetrics ?? [];

  await repo.save({
    userId: null,
    clientId,
    visibleMetrics: sanitized,
    theme: existing?.theme ?? "system",
  });

  if (!kpiKeySetEqual(previous, sanitized)) {
    await sqliteAuditService(db).recordKpiConfigChanged(user, clientId, sanitized, previous);
  }

  return { ok: true, savedKeys: sanitized };
}

/**
 * Server-only. Resolves the KPI set the real dashboard should show for
 * a client, with the single documented precedence:
 *
 *   client DashboardPreference → Package.defaultVisibleKpis → global
 *   DEFAULT_VISIBLE_KPIS
 *
 * Reuses the existing pure resolver (resolveClientPackageSettings in
 * lib/package-settings.ts) rather than re-implementing the rule.
 * Invalid/obsolete stored keys are dropped safely by that resolver.
 * The database handle is injectable for tests (defaults to
 * getDatabase()).
 */
export async function getClientKpiConfiguration(
  clientId: string,
  db: Db = getDatabase()
): Promise<DashboardKpiKey[]> {
  const settings = await getClientPackageSettings(clientId, db);
  return settings.visibleKpis;
}

/**
 * Server-only. The list of clients the given admin may configure, and
 * each client's current resolved KPI set. Uses the central tenant-access
 * boundary (accessibleClientIds): super_admin sees all clients, a normal
 * admin sees only their assigned clients.
 */
export async function getKpiAdminPageData(
  user: Pick<User, "role" | "id" | "clientId">
): Promise<{ clients: { id: string; name: string }[]; configs: Record<string, DashboardKpiKey[]> }> {
  const db = getDatabase();
  const clientRepo = new SqliteClientRepository(db);

  const clientIds = await accessibleClientIds(user);

  const clients = (await clientRepo.findByIds(clientIds)).map((c) => ({
    id: c.id,
    name: c.name,
  }));

  const configs: Record<string, DashboardKpiKey[]> = {};
  for (const client of clients) {
    configs[client.id] = await getClientKpiConfiguration(client.id);
  }

  return { clients, configs };
}