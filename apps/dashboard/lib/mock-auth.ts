import { cookies } from "next/headers";

export type MockRole = "super_admin" | "admin" | "client";

export interface MockSession {
  userId: string;
  role: MockRole;
}

export const MOCK_SESSION_COOKIE = "mock-session";

const MOCK_ROLES: readonly MockRole[] = ["super_admin", "admin", "client"];

export async function getMockSession(): Promise<MockSession | null> {
  const store = await cookies();
  const raw = store.get(MOCK_SESSION_COOKIE)?.value;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<MockSession>;
    if (
      typeof parsed.userId === "string" &&
      parsed.userId.length > 0 &&
      MOCK_ROLES.includes(parsed.role as MockRole)
    ) {
      return { userId: parsed.userId, role: parsed.role as MockRole };
    }
  } catch {
    // Malformed or tampered cookie — treat as logged out.
  }

  return null;
}

export async function getMockRole(): Promise<MockRole | null> {
  const session = await getMockSession();
  return session?.role ?? null;
}