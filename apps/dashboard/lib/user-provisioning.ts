import type { User, UserRepository, ClientRepository } from "@repo/shared";
import { getAuditService } from "@/lib/audit";
import { accessibleClientIds } from "@/lib/access";
import { getDatabase, getRepositories } from "@/lib/db";
import {
  createSupabaseAdminClient,
  type SupabaseAdminClient,
  type SupabaseAdminError,
} from "@/lib/auth/supabase-admin";

export type ProvisioningTargetRole = "admin" | "client";

type Db = ReturnType<typeof getDatabase>;

type ProvisioningDeps = {
  users: UserRepository;
  clients: ClientRepository;
  auth?: SupabaseAdminClient;
  audit: Pick<ReturnType<typeof getAuditService>, "recordUserCreated">;
  accessibleClientIds: (
    actor: Pick<User, "role" | "id" | "clientId">,
    db?: Db
  ) => Promise<string[]>;
};

export interface ProvisionApplicationUserInput {
  email: string;
  fullName: string;
  role: ProvisioningTargetRole | "super_admin";
  clientId?: string | null;
  password: string;
}

export interface ProvisionApplicationUserResult {
  id: string;
  email: string;
  fullName: string;
  role: ProvisioningTargetRole;
  clientId: string | null;
  auditRecorded: boolean;
}

export class ProvisioningError extends Error {
  readonly code:
    | "forbidden"
    | "invalid_input"
    | "duplicate_application_user"
    | "duplicate_auth_user"
    | "auth_error"
    | "application_error";

  constructor(
    code: ProvisioningError["code"],
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ProvisioningError";
    this.code = code;
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isDuplicateAuthError(error: SupabaseAdminError): boolean {
  return error.code === "user_already_exists" || /already exists/i.test(error.message);
}

function assertInput(input: ProvisionApplicationUserInput): asserts input is ProvisionApplicationUserInput & {
  role: ProvisioningTargetRole;
  clientId: string | null;
} {
  if (!isValidEmail(input.email.trim())) {
    throw new ProvisioningError("invalid_input", "A valid email is required.");
  }
  if (!input.fullName.trim() || input.fullName.trim().length > 200) {
    throw new ProvisioningError("invalid_input", "A valid full name is required.");
  }
  if (input.role !== "admin" && input.role !== "client") {
    throw new ProvisioningError("forbidden", "This target role cannot be provisioned.");
  }
  if (!input.password) {
    throw new ProvisioningError("invalid_input", "A password is required.");
  }
  if (input.role === "client" && !input.clientId) {
    throw new ProvisioningError("invalid_input", "A client is required for client users.");
  }
  if (input.role === "admin" && input.clientId) {
    throw new ProvisioningError("invalid_input", "Admin users cannot have client scope.");
  }
}

function resolveDependencies(
  db: Db | undefined,
  deps?: Partial<ProvisioningDeps>
): Omit<ProvisioningDeps, "auth"> & { auth?: SupabaseAdminClient } {
  const repositories = getRepositories(db);
  return {
    users: deps?.users ?? repositories.userRepository,
    clients: deps?.clients ?? repositories.clientRepository,
    auth: deps?.auth,
    audit: deps?.audit ?? getAuditService(db),
    accessibleClientIds: deps?.accessibleClientIds ?? accessibleClientIds,
  };
}

export async function provisionApplicationUser(
  actor: Pick<User, "role" | "id" | "clientId">,
  input: ProvisionApplicationUserInput,
  options: { db?: Db; deps?: Partial<ProvisioningDeps> } = {}
): Promise<ProvisionApplicationUserResult> {
  assertInput(input);
  const email = normalizeEmail(input.email);
  const deps = resolveDependencies(options.db, options.deps);

  if (actor.role !== "admin" && actor.role !== "super_admin") {
    throw new ProvisioningError("forbidden", "Only administrators can provision users.");
  }
  if (actor.role === "admin" && input.role !== "client") {
    throw new ProvisioningError("forbidden", "Admins can only provision client users.");
  }

  const existingApplicationUser = await deps.users.findByNormalizedEmail(email);
  if (existingApplicationUser) {
    throw new ProvisioningError(
      "duplicate_application_user",
      "An application user with this email already exists."
    );
  }

  let clientId: string | null = input.clientId;
  if (input.role === "client") {
    const requestedClientId = clientId;
    if (!requestedClientId) {
      throw new ProvisioningError("invalid_input", "A client is required for client users.");
    }
    const client = await deps.clients.findById(requestedClientId);
    if (!client) {
      throw new ProvisioningError("invalid_input", "The selected client does not exist.");
    }
    const accessible = await deps.accessibleClientIds(actor, options.db);
    if (!accessible.includes(client.id)) {
      throw new ProvisioningError("forbidden", "You cannot provision users for this client.");
    }
    clientId = client.id;
  } else {
    clientId = null;
  }

  const auth = deps.auth ?? createSupabaseAdminClient();
  const createdAuth = await auth.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: false,
  });
  if (createdAuth.error || !createdAuth.data.user) {
    if (createdAuth.error && isDuplicateAuthError(createdAuth.error)) {
      throw new ProvisioningError(
        "duplicate_auth_user",
        "A Supabase Auth user with this email already exists. Explicit linking is required."
      );
    }
    throw new ProvisioningError(
      "auth_error",
      createdAuth.error?.message ?? "Supabase Auth user creation failed."
    );
  }

  const authId = createdAuth.data.user.id;
  let applicationUser: User;
  try {
    applicationUser = await deps.users.create({
      email,
      fullName: input.fullName.trim(),
      role: input.role,
      clientId,
      authId,
    });
  } catch (error) {
    try {
      const cleanup = await auth.auth.admin.deleteUser(authId);
      if (cleanup.error) {
        throw cleanup.error;
      }
    } catch (cleanupError) {
      throw new ProvisioningError(
        "application_error",
        "Application user creation failed and Auth cleanup also failed.",
        { cause: cleanupError }
      );
    }
    throw new ProvisioningError(
      "application_error",
      "Application user creation failed; the newly-created Auth user was cleaned up.",
      { cause: error }
    );
  }

  let auditRecorded = true;
  try {
    await deps.audit.recordUserCreated(actor, applicationUser);
  } catch {
    auditRecorded = false;
  }
  return {
    id: applicationUser.id,
    email: applicationUser.email,
    fullName: applicationUser.fullName,
    role: applicationUser.role as ProvisioningTargetRole,
    clientId: applicationUser.clientId,
    auditRecorded,
  };
}

export async function provisionCurrentUser(
  input: ProvisionApplicationUserInput,
  options: { db?: Db; deps?: Partial<ProvisioningDeps> } = {}
): Promise<ProvisionApplicationUserResult> {
  const { requireUser } = await import("@/lib/access");
  const actor = await requireUser();
  return provisionApplicationUser(actor, input, options);
}
