import {
  SqliteAdminAssignmentRepository,
  SqliteClientRepository,
  SqliteDashboardPreferenceRepository,
} from "@repo/database";
import { getDatabase } from "@/lib/db";
import type { DashboardKpiKey, User } from "@repo/shared";
import { canUserConfigureClientKpis, resolveVisibleKpis } from "@repo/shared";

/**
 * Server-only. Resolves the KPI set a client should see: explicit
 * preference if one exists, otherwise the default set. Invalid/obsolete
 * stored keys are dropped safely by resolveVisibleKpis.
 */
export async function getClientKpiConfiguration(
  clientId: string
): Promise<DashboardKpiKey[]> {
  const repo = new SqliteDashboardPreferenceRepository(getDatabase());
  const preference = await repo.findForClient(clientId);
  return resolveVisibleKpis(preference);
}

/**
 * Server-only. The list of clients the given admin may configure, and
 * each client's current resolved KPI set. super_admin sees all clients;
 * a normal admin sees only their assigned clients.
 */
export async function getKpiAdminPageData(
  user: Pick<User, "role" | "id">
): Promise<{ clients: { id: string; name: string }[]; configs: Record<string, DashboardKpiKey[]> }> {
  const db = getDatabase();
  const clientRepo = new SqliteClientRepository(db);

  let clientIds: string[];
  if (user.role === "super_admin") {
    const all = await clientRepo.list({ limit: 1000 });
    clientIds = all.items.map((c) => c.id);
  } else {
    const assignments = await new SqliteAdminAssignmentRepository(db).findByAdmin(user.id);
    clientIds = assignments.map((a) => a.clientId);
  }

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

/**
 * Server-side authorization gate for KPI configuration. Throws (does not
 * return false) so the mutation fails loudly instead of silently no-oping:
 * clients can never configure their own KPIs, and a normal admin can only
 * configure their assigned clients.
 */
export async function assertCanConfigureKpis(
  user: Pick<User, "role" | "id">,
  clientId: string
): Promise<void> {
  const db = getDatabase();
  let adminAssignedClientIds: readonly string[] = [];
  if (user.role === "admin") {
    const assignments = await new SqliteAdminAssignmentRepository(db).findByAdmin(user.id);
    adminAssignedClientIds = assignments.map((a) => a.clientId);
  }
  if (!canUserConfigureClientKpis(user, clientId, adminAssignedClientIds)) {
    throw new Error("شما اجازه‌ی تنظیم KPI این مشتری را ندارید.");
  }
}