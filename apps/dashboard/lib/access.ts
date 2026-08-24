import { redirect } from "next/navigation";
import type { User, UserRole } from "@repo/shared";
import { getCurrentUser } from "@/lib/get-current-user";
import { getDatabase, getRepositories } from "@/lib/db";

/**
 * Server-only. The single tenant-access boundary for every dashboard
 * request that reads or writes data for a CLIENT.
 *
 * This is the ONE place the rule is encoded:
 *
 *   - super_admin  → any client
 *   - admin        → only clients in AdminAssignmentRepository
 *   - client       → only their own clientId
 *   - unauthenticated → rejected (AccessError, kind "unauthenticated")
 *
 * Individual pages and server actions must never re-implement this
 * rule and must never trust a clientId that arrives from request
 * input (searchParams, action arguments, ...) without first passing it
 * through requireClientAccess() / deriving it from accessibleClientIds().
 *
 * The rule here is the exact semantic set the future Supabase RLS
 * policies will enforce at the Postgres layer; nothing storage-specific
 * lives in this module — it only composes the existing repositories.
 *
 * Request-context conventions:
 *   - Pages (RSC) use requirePageAccess(...roles): unauthenticated →
 *     redirect("/login"), forbidden role → redirect("/dashboard").
 *   - Server actions use requireUser()/requireRole()/requireClientAccess()
 *     inside their try/catch and return { ok: false, error }.
 *
 * Testability: accessibleClientIds()/requireClientAccess() take an
 * optional database handle (defaults to getDatabase(), matching the
 * rest of the server libs); requireUser() takes an injectable resolver.
 */

type Db = ReturnType<typeof getDatabase>;

export type AccessDenial = "unauthenticated" | "forbidden";

/** Typed failure of an access gate. Thrown (never returned as ok:false). */
export class AccessError extends Error {
  readonly kind: AccessDenial;

  constructor(kind: AccessDenial, message: string) {
    super(message);
    this.name = "AccessError";
    this.kind = kind;
  }
}

const UNAUTHENTICATED_MESSAGE = "ابتدا وارد شوید.";
const FORBIDDEN_MESSAGE = "شما اجازه‌ی انجام این کار را ندارید.";
const CLIENT_FORBIDDEN_MESSAGE = "شما اجازه‌ی دسترسی به این مشتری را ندارید.";

/**
 * Resolves the current user or throws AccessError("unauthenticated").
 * The resolver is injectable so the gate is testable without a request
 * scope; in production it is getCurrentUser().
 */
export async function requireUser(
  resolveUser: () => Promise<User | null> = getCurrentUser
): Promise<User> {
  const user = await resolveUser();
  if (!user) {
    throw new AccessError("unauthenticated", UNAUTHENTICATED_MESSAGE);
  }
  return user;
}

/**
 * Role gate: the user's role must be one of the allowed roles, else
 * AccessError("forbidden"). Pure and synchronous.
 */
export function requireRole(
  user: Pick<User, "role">,
  ...roles: readonly UserRole[]
): Pick<User, "role"> {
  if (!roles.includes(user.role)) {
    throw new AccessError("forbidden", FORBIDDEN_MESSAGE);
  }
  return user;
}

/**
 * The clientIds the user may access, per the central rule above.
 * super_admin enumerates all clients; admin resolves their assignments;
 * client resolves to their own clientId (or nothing when unset).
 */
export async function accessibleClientIds(
  user: Pick<User, "role" | "id" | "clientId">,
  db: Db = getDatabase()
): Promise<string[]> {
  // Repositories come from the storage-provider seam on the SAME
  // (possibly injected) handle — the authorization semantics below are
  // unchanged.
  const { adminAssignmentRepository, clientRepository } = getRepositories(db);
  if (user.role === "super_admin") {
    const all = await clientRepository.list({ limit: 1000 });
    return all.items.map((client) => client.id);
  }
  if (user.role === "admin") {
    const assignments = await adminAssignmentRepository.findByAdmin(user.id);
    return assignments.map((assignment) => assignment.clientId);
  }
  return user.clientId ? [user.clientId] : [];
}

/**
 * Throws AccessError("forbidden") unless the user may access the given
 * clientId. super_admin short-circuits (never enumerated — unrestricted).
 * Call this on EVERY clientId that arrives from request input.
 */
export async function requireClientAccess(
  user: Pick<User, "role" | "id" | "clientId">,
  clientId: string,
  db: Db = getDatabase()
): Promise<void> {
  if (user.role === "super_admin") {
    return;
  }
  const allowed = await accessibleClientIds(user, db);
  if (!allowed.includes(clientId)) {
    throw new AccessError("forbidden", CLIENT_FORBIDDEN_MESSAGE);
  }
}

/**
 * Page convention: resolves the user and, when roles are given, enforces
 * them — mapping AccessError to the existing dashboard redirects
 * (unauthenticated → /login, forbidden → /dashboard). Anything that is
 * not an AccessError re-throws.
 */
export async function requirePageAccess(
  ...roles: readonly UserRole[]
): Promise<User> {
  try {
    const user = await requireUser();
    if (roles.length > 0) {
      requireRole(user, ...roles);
    }
    return user;
  } catch (error) {
    if (error instanceof AccessError) {
      redirect(error.kind === "unauthenticated" ? "/login" : "/dashboard");
    }
    throw error;
  }
}