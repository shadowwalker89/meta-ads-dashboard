import { SqliteUserRepository } from "@repo/database";
import type { User } from "@repo/shared";
import { getMockSession } from "@/lib/mock-auth";
import { getDatabase } from "@/lib/db";

/**
 * Resolves the currently mock-authenticated User from SQLite.
 * Server-only — never import from middleware.ts.
 *
 * The mock session stores the seeded user's email as `userId` (seed ids
 * are randomUUID()s the dashboard cannot know), so the user is looked
 * up by email.
 */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getMockSession();
  if (!session) {
    return null;
  }
  const users = new SqliteUserRepository(getDatabase());
  return users.findByEmail(session.userId);
}