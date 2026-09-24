import type { User, UserRepository, ClientRepository } from "@repo/shared";
import { accessibleClientIds, requireRole, requireUser } from "@/lib/access";
import { getAuditService } from "@/lib/audit";
import { getDatabase, getRepositories } from "@/lib/db";
import {
  createSupabaseAdminClient,
  SupabaseAdminConfigurationError,
  type SupabaseAdminClient,
} from "@/lib/auth/supabase-admin";

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
    | "application_error"
    | "configuration_error"
    | "auth_error"
    | "no_auth_identity";
  constructor(
    code: UserLifecycleError["code"],
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
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

  const nextClientId: string | null = input.role === "client" ? input.clientId : null;
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

type PasswordDeps = Pick<LifecycleDeps, "users" | "accessibleClientIds"> & {
  auth?: SupabaseAdminClient;
  audit?: Pick<ReturnType<typeof getAuditService>, "recordUserUpdated">;
};

function isValidPassword(password: string): boolean {
  return password.length >= 1 && password.length <= 256;
}

function assertPasswordTarget(
  actor: User,
  target: User,
  clientScope: string[]
): void {
  if (target.role === "super_admin") {
    throw new UserLifecycleError(
      "protected_super_admin",
      "This super_admin cannot be modified."
    );
  }
  if (actor.role !== "super_admin" && actor.role !== "admin") {
    throw new UserLifecycleError(
      "forbidden",
      "Only administrators can set user passwords."
    );
  }
  if (actor.role === "admin") {
    if (target.role !== "client") {
      throw new UserLifecycleError(
        "forbidden",
        "Admins can only set passwords for client users."
      );
    }
    if (target.clientId !== null && !clientScope.includes(target.clientId)) {
      throw new UserLifecycleError(
        "client_scope",
        "Target is outside your authorized client scope."
      );
    }
  }
}

export interface SetApplicationUserPasswordInput {
  userId: string;
  password: string;
}

export interface SetApplicationUserPasswordResult {
  user: User;
  auditRecorded: boolean;
}

export async function setApplicationUserPassword(
  actor: User,
  input: SetApplicationUserPasswordInput,
  options: { db?: Db; deps?: Partial<PasswordDeps> } = {}
): Promise<SetApplicationUserPasswordResult> {
  const repositories = getRepositories(options.db);
  const users = options.deps?.users ?? repositories.userRepository;
  const resolveAccessibleClientIds =
    options.deps?.accessibleClientIds ?? accessibleClientIds;
  const auth = options.deps?.auth;

  if (!isValidPassword(input.password)) {
    throw new UserLifecycleError("invalid_input", "A valid password is required.");
  }

  const target = await users.findById(input.userId);
  if (!target) {
    throw new UserLifecycleError("not_found", "User not found.");
  }

  const scope = await resolveAccessibleClientIds(actor, options.db);
  assertPasswordTarget(actor, target, scope);

  if (!target.authId) {
    throw new UserLifecycleError(
      "no_auth_identity",
      "This user does not have an authentication identity to update."
    );
  }

  let adminClient: SupabaseAdminClient;
  try {
    adminClient = auth ?? createSupabaseAdminClient();
  } catch (error) {
    if (error instanceof SupabaseAdminConfigurationError) {
      throw new UserLifecycleError("configuration_error", error.message, { cause: error });
    }
    throw error;
  }

  const updateResult = await adminClient.auth.admin.updateUserById(target.authId, {
    password: input.password,
    email_confirm: true,
  });
  if (updateResult.error || !updateResult.data.user) {
    throw new UserLifecycleError(
      "auth_error",
      updateResult.error?.message ?? "The authentication password could not be updated."
    );
  }

  const audit = options.deps?.audit ?? getAuditService(options.db);
  let auditRecorded = true;
  try {
    await audit.recordUserUpdated(actor, target, { passwordReset: true });
  } catch {
    auditRecorded = false;
  }

  return { user: target, auditRecorded };
}

export async function setCurrentApplicationUserPassword(
  input: SetApplicationUserPasswordInput,
  options: { db?: Db; deps?: Partial<PasswordDeps> } = {}
): Promise<SetApplicationUserPasswordResult> {
  const actor = await requireUser();
  return setApplicationUserPassword(actor, input, options);
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
