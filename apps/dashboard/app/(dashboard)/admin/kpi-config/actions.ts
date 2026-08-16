"use server";

import { revalidatePath } from "next/cache";
import { getDatabase } from "@/lib/db";
import { requireUser } from "@/lib/access";
import {
  runSaveClientKpiConfig,
  type SaveKpiConfigResult,
} from "@/lib/kpi-config";

export type { SaveKpiConfigResult };

/**
 * Persists the client's visible KPI set. Authorization is enforced here,
 * server-side via the central tenant-access boundary: a client can never
 * reach this (requireRole rejects non-admins), and a normal admin can
 * only configure their assigned clients (requireClientAccess) — hiding
 * the button in the UI is only a convenience, never the security
 * boundary.
 */
export async function saveClientKpiConfig(
  clientId: string,
  keys: readonly unknown[]
): Promise<SaveKpiConfigResult> {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "شما اجازه‌ی انجام این کار را ندارید.",
    };
  }

  const outcome = await runSaveClientKpiConfig(user, clientId, keys, getDatabase());
  if (outcome.ok) {
    revalidatePath("/dashboard/admin/kpi-config");
  }
  return outcome;
}