import type { DashboardKpiKey, User } from "@repo/shared";
import { DEFAULT_VISIBLE_KPIS } from "@repo/shared";
import { getDatabase } from "@/lib/db";
import { getClientAdminData } from "@/lib/client-admin";
import {
  getClientDashboardData,
  type ClientDashboardData,
} from "@/lib/client-dashboard-data";
import { getClientKpiConfiguration } from "@/lib/kpi-config";
import { requireClientAccess } from "@/lib/access";

/**
 * Server-only. The single authorized read path for the Admin Overview
 * page (/admin).
 *
 * Reuses existing admin/data services only — nothing is reimplemented
 * here:
 *   - accessible clients + ad-account counts come from getClientAdminData
 *     (itself tenant-scoped through accessibleClientIds);
 *   - a selected client's dashboard data goes through the same
 *     getClientDashboardData read as the client dashboard (which re-checks
 *     requireClientAccess), so the admin sees exactly what the client
 *     sees — never fabricated or re-aggregated numbers;
 *   - the KPI set shown is the client's resolved visible KPI set
 *     (preference → package default → global default).
 *
 * The optional clientId arrives from request input and is NEVER trusted:
 * it must match an accessible client and passes through the central
 * access boundary before any data is read.
 */
export interface AdminOverviewData {
  clients: { id: string; name: string; adAccountCount: number }[];
  packageCount: number;
  totalAdAccounts: number;
  selectedClient: { id: string; name: string } | null;
  dashboard: ClientDashboardData | null;
  visibleKpis: DashboardKpiKey[];
}

export async function getAdminOverviewData(
  user: Pick<User, "role" | "id" | "clientId">,
  requestedClientId: string | null,
  db: ReturnType<typeof getDatabase> = getDatabase()
): Promise<AdminOverviewData> {
  const { clients, packages } = await getClientAdminData(user, db);
  const clientList = clients.map((client) => ({
    id: client.id,
    name: client.name,
    adAccountCount: client.adAccountCount,
  }));
  const totalAdAccounts = clients.reduce(
    (sum, client) => sum + client.adAccountCount,
    0
  );

  let selectedClient: AdminOverviewData["selectedClient"] = null;
  let dashboard: AdminOverviewData["dashboard"] = null;
  let visibleKpis: DashboardKpiKey[] = [];

  const match =
    requestedClientId !== null
      ? clientList.find((client) => client.id === requestedClientId)
      : undefined;

  if (match) {
    await requireClientAccess(user, match.id, db);
    selectedClient = { id: match.id, name: match.name };
    dashboard = await getClientDashboardData(user, match.id, db);
    const configured = await getClientKpiConfiguration(match.id, db);
    visibleKpis = configured.length > 0 ? configured : [...DEFAULT_VISIBLE_KPIS];
  }

  return {
    clients: clientList,
    packageCount: packages.length,
    totalAdAccounts,
    selectedClient,
    dashboard,
    visibleKpis,
  };
}