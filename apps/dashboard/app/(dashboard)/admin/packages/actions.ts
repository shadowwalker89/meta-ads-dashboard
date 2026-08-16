"use server";

import { revalidatePath } from "next/cache";
import { getDatabase } from "@/lib/db";
import { requireClientAccess, requireUser } from "@/lib/access";
import {
  runAssignPackage,
  runCreatePackage,
  runUpdatePackage,
  type AssignActionOutput,
  type ActionResult,
  type PackageSettingsInput,
} from "@/lib/package-admin";

const ASSIGN_PAGES = [
  "/dashboard/admin/packages",
  "/dashboard/admin/packages/assign",
  "/dashboard/admin/pricing",
  "/dashboard/admin/pricing/config",
  "/dashboard/admin/kpi-config",
  "/dashboard",
];

/**
 * Creates a new package row. Authorization is enforced server-side:
 * only the Super Admin can reach this action (the lib throws for other
 * roles). The repository sanitizes every setting through the shared
 * domain helpers and validates isValidPackageSettings. No deletion
 * exists — packages have no deactivation model yet.
 */
export async function createPackage(
  input: PackageSettingsInput
): Promise<ActionResult<{ id: string; name: string }>> {
  const user = await requireUser().catch(() => null);
  if (!user) {
    return { ok: false, error: "ابتدا وارد شوید." };
  }
  const outcome = await runCreatePackage(user, input, getDatabase());
  if (outcome.ok) {
    revalidatePath("/dashboard/admin/packages");
    revalidatePath("/dashboard/admin/packages/assign");
  }
  return outcome.ok
    ? { ok: true, value: { id: outcome.value.id, name: outcome.value.name } }
    : { ok: false, error: outcome.error };
}

/** Updates an existing package's settings (full-surface edit). */
export async function updatePackage(
  packageId: string,
  input: PackageSettingsInput
): Promise<ActionResult<{ id: string; name: string }>> {
  const user = await requireUser().catch(() => null);
  if (!user) {
    return { ok: false, error: "ابتدا وارد شوید." };
  }
  const outcome = await runUpdatePackage(user, packageId, input, getDatabase());
  if (outcome.ok) {
    revalidatePath("/dashboard/admin/packages");
    revalidatePath("/dashboard/admin/packages/assign");
  }
  return outcome.ok
    ? { ok: true, value: { id: outcome.value.id, name: outcome.value.name } }
    : { ok: false, error: outcome.error };
}

/**
 * Assigns a client to a package through PackageAssignmentService — the
 * only business entry point. Revalidates every page that surfaces the
 * client's package / pricing, so the UI reflects the new assignment,
 * its timestamp, and the pricing rules materialized from the package
 * defaults. Same-package assignment is idempotent in the service.
 */
export async function assignPackage(
  clientId: string,
  packageId: string
): Promise<ActionResult<AssignActionOutput>> {
  const user = await requireUser().catch(() => null);
  if (!user) {
    return { ok: false, error: "ابتدا وارد شوید." };
  }

  // The clientId arrives as action input; it passes through the central
  // tenant-access boundary. Assignment itself stays super_admin-only via
  // PackageAssignmentService (assertCanManagePackages in the runner).
  await requireClientAccess(user, clientId);

  const outcome = await runAssignPackage(user, clientId, packageId, {
    db: getDatabase(),
  });
  if (outcome.ok) {
    for (const path of ASSIGN_PAGES) {
      revalidatePath(path);
    }
  }
  return outcome;
}