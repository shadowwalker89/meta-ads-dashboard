import type { PackageFeatures, User } from "@repo/shared";
import { requireClientAccess } from "@/lib/access";
import { getClientPackageSettings } from "@/lib/package-settings";
import { getDatabase } from "@/lib/db";

type Db = ReturnType<typeof getDatabase>;

/**
 * Server-only. Resolves the authenticated user's effective Package
 * feature entitlements for a client.
 *
 * This is the ONLY dashboard entry point for feature visibility:
 *
 *   - The clientId is verified through the central tenant-access
 *     boundary (requireClientAccess) BEFORE any package data is read —
 *     a clientId arriving from request input or action arguments is
 *     never trusted here, and a caller can never enable a feature by
 *     modifying query parameters or form data.
 *   - The actual flags are package-authoritative: they come from the
 *     client's Package row (resolveClientPackageSettings in
 *     lib/package-settings.ts), never from the client, never from the
 *     request.
 *   - Missing client/package fall back to the all-false default, so
 *     an unresolved configuration degrades to "nothing extra" instead
 *     of surfacing features that were not granted.
 *
 * The dashboard page gates its feature surfaces purely on the boolean
 * flags returned here — there is no second source of truth.
 */
export async function getClientPackageFeatures(
  user: Pick<User, "role" | "id" | "clientId">,
  clientId: string,
  db: Db = getDatabase()
): Promise<PackageFeatures> {
  await requireClientAccess(user, clientId, db);
  const settings = await getClientPackageSettings(clientId, db);
  return settings.features;
}