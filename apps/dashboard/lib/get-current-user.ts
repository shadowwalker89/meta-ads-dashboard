import type { User } from "@repo/shared";
import { resolveCurrentUser } from "@/lib/auth";

/**
 * Resolves the currently authenticated User for the request, or null.
 * Server-only — never import from middleware.ts.
 *
 * Pure delegation to the auth boundary: AuthProvider.getSession() yields
 * an identity and AuthUserMapper finds the matching application User.
 * The mock provider resolves the seeded user's email; the future
 * Supabase provider resolves the Auth user.id.
 */
export function getCurrentUser(): Promise<User | null> {
  return resolveCurrentUser();
}