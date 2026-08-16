import type { AuthProviderName } from "./types";

export interface AuthEnv {
  NODE_ENV?: string;
  AUTH_PROVIDER?: string;
}

/**
 * Resolves which AuthProvider this runtime must use. Pure and free of
 * any server-only import so middleware.ts (Edge runtime) can call it.
 *
 * Production is explicit by design: with NODE_ENV=production the
 * provider MUST be "supabase". The mock provider's login cookie is
 * forgeable (plain JSON, dev-only), so silently falling back to it in
 * production would let anyone authenticate — that path throws instead.
 *
 * Dev/test default to the mock provider so the app runs without
 * configuration; any unknown value throws loudly.
 */
export function resolveAuthProviderName(env: AuthEnv): AuthProviderName {
  const provided = env.AUTH_PROVIDER;

  if (env.NODE_ENV === "production") {
    if (provided === "supabase") {
      return "supabase";
    }
    throw new Error(
      "AUTH_PROVIDER must be 'supabase' in production; mock authentication is not allowed. Refusing to start with a forgeable session."
    );
  }

  if (provided === undefined || provided === "") {
    return "mock";
  }
  if (provided === "mock" || provided === "supabase") {
    return provided;
  }
  throw new Error(
    `Unknown AUTH_PROVIDER '${provided}'. Supported values: mock, supabase.`
  );
}