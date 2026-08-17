"use server";

import { revalidatePath } from "next/cache";
import { getDatabase } from "@/lib/db";
import { requireUser } from "@/lib/access";
import {
  runCreateAdAccount,
  runCreateClient,
  runDeactivateClient,
  runUpdateAdAccountSource,
  runUpdateAdAccountStatus,
  type ActionResult,
} from "@/lib/client-admin";
import type { AdAccount } from "@repo/shared";

const CLIENTS_PAGE = "/dashboard/admin/clients";

/**
 * Creates a new client. Authorization is enforced server-side: only the
 * Super Admin can reach this action. A client is always created active
 * and assigned to the chosen package (the schema requires package_id).
 */
export async function createClient(input: {
  name: string;
  businessType: string;
  contactEmail: string;
  packageId: string;
}): Promise<ActionResult<{ id: string; name: string }>> {
  const user = await requireUser().catch(() => null);
  if (!user) {
    return { ok: false, error: "ابتدا وارد شوید." };
  }
  const outcome = await runCreateClient(user, input, getDatabase());
  if (outcome.ok) {
    revalidatePath(CLIENTS_PAGE);
  }
  return outcome.ok
    ? { ok: true, value: { id: outcome.value.id, name: outcome.value.name } }
    : { ok: false, error: outcome.error };
}

/**
 * Deactivates a client (is_active = 0). No deletion exists — this is the
 * supported off-ramp. Deactivated clients remain in the data and their
 * ad accounts remain readable.
 */
export async function deactivateClient(clientId: string): Promise<
  ActionResult<{ id: string; name: string }>
> {
  const user = await requireUser().catch(() => null);
  if (!user) {
    return { ok: false, error: "ابتدا وارد شوید." };
  }
  const outcome = await runDeactivateClient(user, clientId, getDatabase());
  if (outcome.ok) {
    revalidatePath(CLIENTS_PAGE);
    revalidatePath(`${CLIENTS_PAGE}/${clientId}`);
  }
  return outcome.ok
    ? { ok: true, value: { id: outcome.value.id, name: outcome.value.name } }
    : { ok: false, error: outcome.error };
}

/**
 * Creates a new AdAccount for a client. Enforces Package.maxAdAccounts at
 * the business layer (SqlitePackageEnforcement) and records an audit
 * entry. metaAdAccountId is optional — it can be set later via
 * updateAdAccountSource once the real Meta id is known.
 */
export async function createAdAccount(input: {
  clientId: string;
  name: string;
  status: AdAccount["status"];
  source: AdAccount["source"];
  metaAdAccountId: string | null;
}): Promise<ActionResult<{ id: string; name: string }>> {
  const user = await requireUser().catch(() => null);
  if (!user) {
    return { ok: false, error: "ابتدا وارد شوید." };
  }
  const outcome = await runCreateAdAccount(user, input, getDatabase());
  if (outcome.ok) {
    revalidatePath(CLIENTS_PAGE);
    revalidatePath(`${CLIENTS_PAGE}/${input.clientId}`);
  }
  return outcome.ok
    ? { ok: true, value: { id: outcome.value.id, name: outcome.value.name } }
    : { ok: false, error: outcome.error };
}

/**
 * Sets the collector source and Meta ad account id for an AdAccount. The
 * id arrives as action input and passes through the central tenant-access
 * boundary in the runner.
 */
export async function updateAdAccountSource(
  adAccountId: string,
  source: AdAccount["source"],
  metaAdAccountId: string | null
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser().catch(() => null);
  if (!user) {
    return { ok: false, error: "ابتدا وارد شوید." };
  }
  const outcome = await runUpdateAdAccountSource(
    user,
    adAccountId,
    source,
    metaAdAccountId,
    getDatabase()
  );
  if (outcome.ok) {
    revalidatePath(CLIENTS_PAGE);
    revalidatePath(`${CLIENTS_PAGE}/${outcome.value.clientId}`);
  }
  return outcome.ok
    ? { ok: true, value: { id: outcome.value.id } }
    : { ok: false, error: outcome.error };
}

/** Updates an AdAccount status (connected / pending / error). */
export async function updateAdAccountStatus(
  adAccountId: string,
  status: AdAccount["status"]
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser().catch(() => null);
  if (!user) {
    return { ok: false, error: "ابتدا وارد شوید." };
  }
  const outcome = await runUpdateAdAccountStatus(user, adAccountId, status, getDatabase());
  if (outcome.ok) {
    revalidatePath(CLIENTS_PAGE);
    revalidatePath(`${CLIENTS_PAGE}/${outcome.value.clientId}`);
  }
  return outcome.ok
    ? { ok: true, value: { id: outcome.value.id } }
    : { ok: false, error: outcome.error };
}