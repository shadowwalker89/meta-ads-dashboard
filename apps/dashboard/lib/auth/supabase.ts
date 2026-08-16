import type { User } from "@repo/shared";
import type {
  AuthProvider,
  AuthSession,
  AuthSignInInput,
  AuthUserMapper,
} from "./types";

export interface SupabaseAuthEnv {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
}

function assertConfigured(env: SupabaseAuthEnv): void {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase Auth is selected but SUPABASE_URL / SUPABASE_ANON_KEY are not set. The dashboard refuses to start with a real auth provider that is not configured."
    );
  }
}

/**
 * Real-auth boundary for the deployment phase. This class deliberately
 * contains NO working implementation yet: Supabase Auth (session
 * refresh, @supabase/ssr middleware, magic-link / password flows) is
 * wired during the deployment phase of this project, not now. Until
 * then every method fails loudly so nothing silently pretends real auth
 * is active.
 *
 * The important contract is the shape: getSession() returns the
 * request's authenticated identity, signIn()/signOut() mutate it, and
 * only the ANON key (never the service-role key) may ever be held by
 * this browser-safe boundary.
 */
export class SupabaseAuthProvider implements AuthProvider {
  readonly name = "supabase" as const;

  constructor(env: SupabaseAuthEnv) {
    assertConfigured(env);
  }

  async signIn(_input: AuthSignInInput): Promise<AuthSession> {
    void _input;
    throw new Error(
      "Supabase signIn is not wired yet (deployment phase). Mock provider remains the active auth for dev."
    );
  }

  async signOut(): Promise<void> {
    throw new Error(
      "Supabase signOut is not wired yet (deployment phase)."
    );
  }

  async getSession(): Promise<AuthSession | null> {
    throw new Error(
      "Supabase getSession is not wired yet (deployment phase)."
    );
  }
}

/**
 * Real-auth mapper. Keyed on the Supabase Auth user.id, mapped to the
 * application User row. Not implemented until the deployment phase; the
 * shape documents that email is NOT the long-term mapping key.
 */
export class SupabaseAuthUserMapper implements AuthUserMapper {
  readonly provider = "supabase" as const;

  async findByAuthId(_authId: string): Promise<User | null> {
    void _authId;
    throw new Error(
      "Supabase user mapping is not wired yet (deployment phase)."
    );
  }
}