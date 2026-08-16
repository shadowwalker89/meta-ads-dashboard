import type { User } from "@repo/shared";
import { resolveAuthProviderName } from "./config";
import {
  createMockAuthProvider,
  createMockAuthUserMapper,
} from "./mock";
import { SupabaseAuthProvider, SupabaseAuthUserMapper } from "./supabase";
import type { AuthProvider, AuthUserMapper } from "./types";

export * from "./types";
export * from "./config";
export { MockAuthProvider, createMockAuthProvider } from "./mock";
export { MockAuthUserMapper, createMockAuthUserMapper } from "./mock";
export { SupabaseAuthProvider, SupabaseAuthUserMapper } from "./supabase";

/**
 * Constructs the provider selected by AUTH_PROVIDER / NODE_ENV.
 * Server-only (the default mock construction may touch the database).
 * Injectable via env for tests.
 */
export function getAuthProvider(
  env: Record<string, string | undefined> = process.env
): AuthProvider {
  const name = resolveAuthProviderName(env);
  if (name === "mock") {
    return createMockAuthProvider();
  }
  return new SupabaseAuthProvider({
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
  });
}

export function getAuthUserMapper(
  env: Record<string, string | undefined> = process.env
): AuthUserMapper {
  const name = resolveAuthProviderName(env);
  if (name === "mock") {
    return createMockAuthUserMapper();
  }
  return new SupabaseAuthUserMapper();
}

/**
 * Resolves the currently authenticated application User for the request.
 * Flow: provider.getSession() -> AuthIdentity -> AuthUserMapper -> User.
 *
 * Returns null when signed out. A signed-in identity with NO matching
 * User row throws instead of returning null: an orphaned auth identity
 * must never become an anonymous authorization (and must not silently
 * look "logged out" in a way that hides a broken mapping).
 *
 * deps are injectable so tests can use an in-memory session store and
 * fake user repository without a request scope.
 */
export async function resolveCurrentUser(
  deps: {
    provider?: AuthProvider;
    mapper?: AuthUserMapper;
  } = {}
): Promise<User | null> {
  const provider = deps.provider ?? getAuthProvider();
  const mapper = deps.mapper ?? getAuthUserMapper();

  const session = await provider.getSession();
  if (!session) {
    return null;
  }

  const user = await mapper.findByAuthId(session.identity.id);
  if (!user) {
    throw new Error(
      `Authenticated identity '${session.identity.id}' has no matching application User. Refusing to authorize anonymously.`
    );
  }
  return user;
}