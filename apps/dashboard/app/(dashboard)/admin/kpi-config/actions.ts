"use server";

import { revalidatePath } from "next/cache";
import { SqliteDashboardPreferenceRepository } from "@repo/database";
import type { DashboardKpiKey } from "@repo/shared";
import { sanitizeDashboardKpiKeys } from "@repo/shared";
import { getCurrentUser } from "@/lib/get-current-user";
import { assertCanConfigureKpis } from "@/lib/kpi-config";
import { getDatabase } from "@/lib/db";

export type SaveKpiConfigResult =
  | { ok: true; savedKeys: DashboardKpiKey[] }
  | { ok: false; error: string };

/**
 * Persists the client's visible KPI set. Authorization is enforced here,
 * server-side: a client can never reach this (assertCanConfigureKpis
 * throws for non-admins and for unassigned clients) — hiding the button
 * in the UI is only a convenience, never the security boundary.
 */
export async function saveClientKpiConfig(
  clientId: string,
  keys: readonly unknown[]
): Promise<SaveKpiConfigResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "ابتدا وارد شوید." };
  }

  try {
    await assertCanConfigureKpis(user, clientId);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "اجازه‌ی انجام این کار را ندارید.",
    };
  }

  const sanitized = sanitizeDashboardKpiKeys(keys);
  const repo = new SqliteDashboardPreferenceRepository(getDatabase());
  const existing = await repo.findForClient(clientId);

  await repo.save({
    userId: null,
    clientId,
    visibleMetrics: sanitized,
    theme: existing?.theme ?? "system",
  });

  revalidatePath("/dashboard/admin/kpi-config");
  return { ok: true, savedKeys: sanitized };
}