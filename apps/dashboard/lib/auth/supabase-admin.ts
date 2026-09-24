import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SupabaseAdminEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export class SupabaseAdminConfigurationError extends Error {
  readonly code = "configuration_error";

  constructor() {
    super("Supabase Admin API is not configured on the server.");
    this.name = "SupabaseAdminConfigurationError";
  }
}

export interface SupabaseAdminUser {
  id: string;
  email?: string | null;
}

export interface SupabaseAdminAuth {
  admin: {
    createUser(input: {
      email: string;
      password: string;
      email_confirm?: boolean;
    }): Promise<{ data: { user: SupabaseAdminUser | null }; error: SupabaseAdminError | null }>;
    deleteUser(id: string): Promise<{ error: SupabaseAdminError | null }>;
    getUserById(id: string): Promise<{ data: { user: SupabaseAdminUser | null }; error: SupabaseAdminError | null }>;
    updateUserById(
      id: string,
      input: { password?: string; email_confirm?: boolean }
    ): Promise<{ data: { user: SupabaseAdminUser | null }; error: SupabaseAdminError | null }>;
  };
}

export interface SupabaseAdminError {
  message: string;
  code?: string;
  status?: number;
}

export interface SupabaseAdminClient {
  auth: SupabaseAdminAuth;
}

function assertConfigured(env: SupabaseAdminEnv): asserts env is Required<SupabaseAdminEnv> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new SupabaseAdminConfigurationError();
  }
}

export function createSupabaseAdminClient(
  env: SupabaseAdminEnv = process.env as SupabaseAdminEnv
): SupabaseAdminClient {
  assertConfigured(env);
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as unknown as SupabaseClient & SupabaseAdminClient;
}
