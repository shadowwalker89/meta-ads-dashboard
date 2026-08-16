import type { User } from "@repo/shared";

/**
 * Provider-agnostic authentication boundary.
 *
 * The dashboard knows ONLY these shapes. Everything specific to a
 * provider (mock cookie, Supabase session) lives behind AuthProvider /
 * AuthUserMapper implementations in this folder; nothing else in the
 * app may import provider code directly.
 */

export type AuthProviderName = "mock" | "supabase";

/**
 * Who the user claims to be at the auth layer. It is NOT authorization:
 * role, client relationship and admin assignments always come from the
 * application User row via AuthUserMapper, never from this object.
 */
export interface AuthIdentity {
  /** Provider-side stable id (Supabase Auth user.id long-term; seeded email in dev mock). */
  id: string;
  provider: AuthProviderName;
}

export interface AuthSession {
  identity: AuthIdentity;
}

export interface AuthSignInInput {
  /**
   * Identifier the human typed on the login page. The mock provider
   * resolves it to a seeded account's email; the Supabase provider will
   * use it for the real sign-in flow in the deployment phase.
   */
  email: string;
}

/**
 * A sign-in/sign-out/session boundary for one provider. Implementations
 * are server-only except the future Supabase browser session helper,
 * which still talks through this same shape.
 */
export interface AuthProvider {
  readonly name: AuthProviderName;

  signIn(input: AuthSignInInput): Promise<AuthSession>;
  signOut(): Promise<void>;

  /**
   * The request's current authenticated session, or null when signed
   * out. Reads the provider's session store (mock cookie today; Supabase
   * session in the deployment phase).
   */
  getSession(): Promise<AuthSession | null>;
}

/**
 * The ONLY bridge between an authenticated identity and the application
 * User. Keyed on the auth identity id. The mock implementation uses
 * email as a documented, transitional, dev-only bridge; Supabase will
 * key on user.id — email is NOT the long-term primary mapping.
 */
export interface AuthUserMapper {
  readonly provider: AuthProviderName;
  findByAuthId(authId: string): Promise<User | null>;
}