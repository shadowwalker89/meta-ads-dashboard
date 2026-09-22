import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SupabaseAdminEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
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
    throw new Error(
      "Supabase Admin API is selected but SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set."
    );
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
