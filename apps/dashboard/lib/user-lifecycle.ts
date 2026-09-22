import type { User, UserRepository, ClientRepository } from "@repo/shared";
import { accessibleClientIds, requireRole, requireUser } from "@/lib/access";
import { getAuditService } from "@/lib/audit";
import { getDatabase, getRepositories } from "@/lib/db";

type Db = ReturnType<typeof getDatabase>;

export class UserLifecycleError extends Error {
  readonly code:
    | "unauthenticated"
    | "forbidden"
    | "not_found"
    | "invalid_input"
    | "protected_super_admin"
    | "self_deactivation"
    | "last_admin"
    | "client_scope"
    | "application_error";
  constructor(code: UserLifecycleError["code"], message: string) {
    super(message);
    this.name = "UserLifecycleError";
    this.code = code;
  }
}

type LifecycleDeps = {
  users: UserRepository;
  clients: ClientRepository;
  audit: {
    recordUserUpdated: ReturnType<typeof getAuditService>["recordUserUpdated"];
    recordUserStatusChanged: ReturnType<typeof getAuditService>["recordUserStatusChanged"];
  };
  accessibleClientIds: (
    actor: Pick<User, "role" | "id" | "clientId">,
    db?: Db
  ) => Promise<string[]>;
  now?: () => Date;
};

function resolveDeps(db: Db | undefined, deps?: Partial<LifecycleDeps>): LifecycleDeps {
  const repositories = getRepositories(db);
  return {
    users: deps?.users ?? repositories.userRepository,
    clients: deps?.clients ?? repositories.clientRepository,
    audit: deps?.audit ?? getAuditService(db),
    accessibleClientIds: deps?.accessibleClientIds ?? accessibleClientIds,
    now: deps?.now,
  };
}

function editableRoleFor(actor: User): Array<"admin" | "client"> {
  return actor.role === "super_admin" ? ["admin", "client"] : ["client"];
}

function assertEditable(actor: User, target: User, role: "admin" | "client" | null, clientScope: string[]): void {
  if (target.role === "super_admin") {
    throw new UserLifecycleError("protected_super_admin", "Target is a protected super_admin.");
  }
  if (actor.role !== "super_admin" && actor.role !== "admin") {
    throw new UserLifecycleError("forbidden", "Only administrators can edit users.");
  }
  if (actor.role === "admin") {
    if (role !== "client") {
      throw new UserLifecycleError("forbidden", "Admins can only assign the client role.");
    }
    if (target.role !== "client") {
      throw new UserLifecycleError("forbidden", "Admins can only edit client users.");
    }
  }
  if (target.clientId !== null && !clientScope.includes(target.clientId)) {
    throw new UserLifecycleError("client_scope", "Target is outside your authorized client scope.");
  }
}

function assertSelfNotDeactivated(actor: User, target: User, nextActive: boolean): void {
  if (!nextActive && target.id === actor.id) {
    throw new UserLifecycleError("self_deactivation", "You cannot deactivate your own account.");
  }
}

async function assertLastActiveAdmin(
  deps: LifecycleDeps,
  target: User,
  nextActive: boolean
): Promise<void> {
  if (nextActive) return;
  if (target.role !== "admin") return;
  const remaining = (await deps.users.listAll()).filter(
    (user) => user.role === "admin" && user.isActive !== false && user.id !== target.id
  );
  if (remaining.length === 0) {
    throw new UserLifecycleError("last_admin", "The last active admin cannot be deactivated.");
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export interface UpdateApplicationUserInput {
  userId: string;
  fullName: string;
  role: "admin" | "client";
  clientId: string | null;
}

export interface UpdateApplicationUserResult {
  user: User;
  auditRecorded: boolean;
}

export async function updateApplicationUser(
  actor: User,
  input: UpdateApplicationUserInput,
  options: { db?: Db; deps?: Partial<LifecycleDeps> } = {}
): Promise<UpdateApplicationUserResult> {
  const deps = resolveDeps(options.db, options.deps);
  const target = await deps.users.findById(input.userId);
  if (!target) throw new UserLifecycleError("not_found", "User not found.");

  const name = input.fullName.trim();
  if (!name || name.length > 200) {
    throw new UserLifecycleError("invalid_input", "A valid full name is required.");
  }
  if (input.role !== "admin" && input.role !== "client") {
    throw new UserLifecycleError("invalid_input", "A valid role is required.");
  }
  if (input.role === "client" && !input.clientId) {
    throw new UserLifecycleError("invalid_input", "A client is required for client users.");
  }
  if (input.role === "admin" && input.clientId) {
    throw new UserLifecycleError("invalid_input", "Admin users cannot have client scope.");
  }
  const accessible = await deps.accessibleClientIds(actor, options.db);
  assertEditable(actor, target, input.role, accessible);

  let nextClientId: string | null = input.role === "client" ? input.clientId : null;
  if (nextClientId) {
    const client = await deps.clients.findById(nextClientId);
    if (!client) throw new UserLifecycleError("invalid_input", "The selected client does not exist.");
    if (!accessible.includes(client.id)) {
      throw new UserLifecycleError("client_scope", "The selected client is outside your scope.");
    }
  }

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  if (target.fullName !== name) changes.fullName = { from: target.fullName, to: name };
  if (target.role !== input.role) changes.role = { from: target.role, to: input.role };
  if ((target.clientId ?? null) !== nextClientId) {
    changes.clientId = { from: target.clientId, to: nextClientId };
  }

  let updated: User;
  try {
    updated = await deps.users.update(target.id, {
      fullName: name,
      role: input.role,
      clientId: nextClientId,
    });
  } catch (error) {
    throw new UserLifecycleError(
      "application_error",
      error instanceof Error ? error.message : "Application user update failed."
    );
  }

  let auditRecorded = true;
  if (Object.keys(changes).length > 0) {
    try {
      await deps.audit.recordUserUpdated(actor, updated, changes);
    } catch {
      auditRecorded = false;
    }
  }

  return { user: updated, auditRecorded };
}

export interface SetApplicationUserStatusInput {
  userId: string;
  isActive: boolean;
}

export interface SetApplicationUserStatusResult {
  user: User;
  auditRecorded: boolean;
}

export async function setApplicationUserStatus(
  actor: User,
  input: SetApplicationUserStatusInput,
  options: { db?: Db; deps?: Partial<LifecycleDeps> } = {}
): Promise<SetApplicationUserStatusResult> {
  const deps = resolveDeps(options.db, options.deps);
  const target = await deps.users.findById(input.userId);
  if (!target) throw new UserLifecycleError("not_found", "User not found.");
  if (target.role === "super_admin") {
    throw new UserLifecycleError("protected_super_admin", "super_admin cannot be deactivated.");
  }
  requireRole(actor, "admin", "super_admin");
  if (actor.role === "admin" && target.role !== "client") {
    if (target.id === actor.id && !input.isActive) {
      throw new UserLifecycleError("self_deactivation", "You cannot deactivate your own account.");
    }
    throw new UserLifecycleError("forbidden", "Admins can only change status of client users.");
  }
  const accessible = await deps.accessibleClientIds(actor, options.db);
  if (target.clientId !== null && !accessible.includes(target.clientId)) {
    throw new UserLifecycleError("client_scope", "Target is outside your authorized client scope.");
  }
  assertSelfNotDeactivated(actor, target, input.isActive);
  await assertLastActiveAdmin(deps, target, input.isActive);

  if ((target.isActive ?? true) === input.isActive) {
    return { user: target, auditRecorded: true };
  }

  let updated: User;
  try {
    updated = await deps.users.update(target.id, { isActive: input.isActive });
  } catch (error) {
    throw new UserLifecycleError(
      "application_error",
      error instanceof Error ? error.message : "Application user status update failed."
    );
  }

  let auditRecorded = true;
  try {
    await deps.audit.recordUserStatusChanged(actor, updated, input.isActive);
  } catch {
    auditRecorded = false;
  }
  return { user: updated, auditRecorded };
}

export interface UserLifecycleActorContext {
  actor: User;
  db?: Db;
}

export async function updateCurrentApplicationUser(
  input: UpdateApplicationUserInput,
  options: { db?: Db; deps?: Partial<LifecycleDeps> } = {}
): Promise<UpdateApplicationUserResult> {
  const actor = await requireUser();
  return updateApplicationUser(actor, input, options);
}

export async function setCurrentApplicationUserStatus(
  input: SetApplicationUserStatusInput,
  options: { db?: Db; deps?: Partial<LifecycleDeps> } = {}
): Promise<SetApplicationUserStatusResult> {
  const actor = await requireUser();
  return setApplicationUserStatus(actor, input, options);
}

export { editableRoleFor, isValidEmail };
