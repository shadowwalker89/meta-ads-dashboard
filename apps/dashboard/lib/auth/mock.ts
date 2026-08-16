import { SqliteUserRepository } from "@repo/database";
import type { User, UserRepository } from "@repo/shared";
import { getDatabase } from "@/lib/db";
import {
  createNextCookiesMockSessionStore,
  type MockSessionStore,
} from "@/lib/mock-auth";
import type {
  AuthProvider,
  AuthSession,
  AuthSignInInput,
  AuthUserMapper,
} from "./types";

export interface MockAuthDeps {
  store: MockSessionStore;
  users: Pick<UserRepository, "findByEmail">;
}

/**
 * Dev/test-only auth provider. The cookie stores ONLY the identity
 * handle (the seeded user's email, used as the dev bridge id); there is
 * no role in the cookie and an arbitrary identity cannot be asserted —
 * signIn validates the email against the application User repository,
 * so only real seeded accounts can log in. Authorization always comes
 * from the User row via access.ts, never from this cookie.
 */
export class MockAuthProvider implements AuthProvider {
  readonly name = "mock" as const;

  constructor(private readonly deps: MockAuthDeps) {}

  async signIn(input: AuthSignInInput): Promise<AuthSession> {
    const user = await this.deps.users.findByEmail(input.email);
    if (!user) {
      throw new Error(
        `Unknown user '${input.email}'; mock login only accepts seeded accounts.`
      );
    }
    const identity = { id: user.email, provider: "mock" as const };
    await this.deps.store.set({ userId: identity.id });
    return { identity };
  }

  async signOut(): Promise<void> {
    await this.deps.store.delete();
  }

  async getSession(): Promise<AuthSession | null> {
    const payload = await this.deps.store.get();
    if (!payload) {
      return null;
    }
    return { identity: { id: payload.userId, provider: "mock" as const } };
  }
}

export function createMockAuthProvider(
  deps: Partial<MockAuthDeps> = {}
): MockAuthProvider {
  return new MockAuthProvider({
    store: deps.store ?? createNextCookiesMockSessionStore(),
    users: deps.users ?? new SqliteUserRepository(getDatabase()),
  });
}

/**
 * Dev/test mapper. The mock identity is the seeded user's email; the
 * long-term Supabase mapper keys on the Auth user.id. This email bridge
 * is explicitly transitional and documented as such.
 */
export class MockAuthUserMapper implements AuthUserMapper {
  readonly provider = "mock" as const;

  constructor(private readonly users: Pick<UserRepository, "findByEmail">) {}

  async findByAuthId(authId: string): Promise<User | null> {
    return this.users.findByEmail(authId);
  }
}

export function createMockAuthUserMapper(
  users: Pick<UserRepository, "findByEmail"> = new SqliteUserRepository(
    getDatabase()
  )
): MockAuthUserMapper {
  return new MockAuthUserMapper(users);
}