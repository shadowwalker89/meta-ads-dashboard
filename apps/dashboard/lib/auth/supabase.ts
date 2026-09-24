import { cookies } from "next/headers";
import type { User } from "@repo/shared";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getRepositories } from "@/lib/db";
import type {
  AuthProvider,
  AuthSession,
  AuthSignInInput,
  AuthUserMapper,
} from "./types";

export interface SupabaseAuthEnv {
  NODE_ENV?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
}

function assertConfigured(env: SupabaseAuthEnv): asserts env is Required<SupabaseAuthEnv> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase Auth is selected but SUPABASE_URL / SUPABASE_ANON_KEY are not set. The dashboard refuses to start with a real auth provider that is not configured."
    );
  }
}

type SupabaseCookie = {
  name: string;
  value: string;
  options: CookieOptions;
};

type SupabaseAuthClient = {
  auth: {
    signInWithPassword(input: {
      email: string;
      password: string;
    }): Promise<{
      data: {
        user: { id: string; email?: string | null } | null;
        session?: unknown | null;
      };
      error: { message: string; code?: string; status?: number } | null;
    }>;
    getUser(): Promise<{
      data: { user: { id: string; email?: string | null } | null };
      error: { message: string } | null;
    }>;
    signOut(): Promise<{ error: { message: string } | null }>;
  };
};
type SupabaseClientFactory = (
  env: SupabaseAuthEnv
) => Promise<SupabaseAuthClient>;

async function applyCookies(updated: SupabaseCookie[]): Promise<void> {
  try {
    const jar = await cookies();
    for (const { name, value, options } of updated) {
      jar.set(name, value, options);
    }
  } catch {
    return;
  }
}

export async function createSupabaseServerClient(
  env: SupabaseAuthEnv
): Promise<SupabaseAuthClient> {
  assertConfigured(env);
  return createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      async getAll() {
        return (await cookies())
          .getAll()
          .map(({ name, value }) => ({ name, value }));
      },
      async setAll(updated) {
        await applyCookies(updated);
      },
    },
  });
}

/**
 * Real-auth boundary backed by Supabase email/password sign-in and the
 * official @supabase/ssr cookie session. Tokens live exclusively in
 * HttpOnly Supabase-managed cookies — never in the mock-session cookie
 * and never in application-readable state.
 */
export class SupabaseAuthProvider implements AuthProvider {
  readonly name = "supabase" as const;

  constructor(
    private readonly env: SupabaseAuthEnv,
    private readonly createClient: SupabaseClientFactory = createSupabaseServerClient
  ) {
    assertConfigured(env);
  }

  async signIn(input: AuthSignInInput): Promise<AuthSession> {
    if (!input.password) {
      throw new Error("Password is required for Supabase sign-in.");
    }
    const supabase = await this.createClient(this.env);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });
    if (this.env.NODE_ENV === "development") {
      console.debug("[supabase-auth] sign-in", {
        projectRef: this.env.SUPABASE_URL?.match(
          /^https?:\/\/([a-z0-9]{20})\.supabase\.co/
        )?.[1] ?? "unknown",
        normalizedEmail: input.email.trim().toLowerCase(),
        errorMessage: error?.message ?? null,
        errorCode: error?.code ?? null,
        errorStatus: error?.status ?? null,
        sessionReturned: Boolean(data.session),
        userId: data.user?.id ?? null,
      });
    }
    if (error || !data.user) {
      throw new Error(error?.message ?? "Sign-in failed.");
    }
    return {
      identity: {
        id: data.user.id,
        ...(data.user.email ? { email: data.user.email } : {}),
        provider: "supabase",
      },
    };
  }

  async signOut(): Promise<void> {
    const supabase = await this.createClient(this.env);
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(`Sign-out failed: ${error.message}`);
    }
  }

  async getSession(): Promise<AuthSession | null> {
    const supabase = await this.createClient(this.env);
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return null;
    }
    return {
      identity: {
        id: data.user.id,
        ...(data.user.email ? { email: data.user.email } : {}),
        provider: "supabase",
      },
    };
  }
}

/**
 * Bridges a Supabase Auth user.id to the application User row via the
 * users.auth_id column. Unknown identities resolve to null so
 * resolveCurrentUser rejects them loudly instead of authorizing
 * anonymously.
 */
export interface SupabaseAuthMappingPolicy {
  allowEmailFallback: boolean;
  persistEmailLink: boolean;
}

const DEFAULT_MAPPING_POLICY: SupabaseAuthMappingPolicy = {
  allowEmailFallback: true,
  persistEmailLink: false,
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class SupabaseAuthUserMapper implements AuthUserMapper {
  readonly provider = "supabase" as const;

  constructor(
    private readonly users: Pick<
      import("@repo/shared").UserRepository,
      "findByAuthId" | "findByNormalizedEmail" | "setAuthId"
    > = getRepositories().userRepository,
    private readonly policy: SupabaseAuthMappingPolicy = DEFAULT_MAPPING_POLICY
  ) {}

  async findByAuthId(authId: string, email?: string): Promise<User | null> {
    const linked = await this.users.findByAuthId(authId);
    if (linked || !email || !this.policy.allowEmailFallback) {
      return linked;
    }

    const existing = await this.users.findByNormalizedEmail(normalizeEmail(email));
    if (!existing || !this.policy.persistEmailLink) {
      return existing;
    }

    const didLink = await this.users.setAuthId(existing.id, authId);
    return didLink ? existing : null;
  }
}