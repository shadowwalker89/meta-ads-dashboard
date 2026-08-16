import { cookies } from "next/headers";

export const MOCK_SESSION_COOKIE = "mock-session";

/**
 * The dev/test mock session stores ONLY an identity handle — never a
 * role. Role, client relationship and admin assignments are read from
 * the application User row (AuthUserMapper -> repositories) at request
 * time, exactly like the future Supabase path. Putting role/client
 * rights into the cookie would make them user-forgeable authorization,
 * which access.ts must stay free of.
 */
export interface MockAuthSessionPayload {
  userId: string;
}

export interface MockSessionStore {
  get(): Promise<MockAuthSessionPayload | null>;
  set(payload: MockAuthSessionPayload): Promise<void>;
  delete(): Promise<void>;
}

export function serializeMockSession(
  payload: MockAuthSessionPayload
): string {
  return JSON.stringify({ userId: payload.userId });
}

export function parseMockSession(
  raw: string
): MockAuthSessionPayload | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // Only { userId } is accepted. A cookie that smuggles extra claims
    // (role, clientId, ...) is treated as tampered -> signed out, so the
    // request lands on access.ts unauthenticated and is rejected there.
    if (
      typeof parsed.userId === "string" &&
      parsed.userId.length > 0 &&
      Object.keys(parsed).length === 1
    ) {
      return { userId: parsed.userId };
    }
  } catch {
    // Malformed or tampered cookie — treat as signed out.
  }
  return null;
}

/**
 * Next.js request-scoped store adapter. Server-only (cookies() needs a
 * request context); tests inject an in-memory MockSessionStore instead.
 */
export function createNextCookiesMockSessionStore(): MockSessionStore {
  return {
    async get() {
      const store = await cookies();
      const raw = store.get(MOCK_SESSION_COOKIE)?.value;
      return raw ? parseMockSession(raw) : null;
    },
    async set(payload) {
      const store = await cookies();
      store.set(MOCK_SESSION_COOKIE, serializeMockSession(payload), {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    },
    async delete() {
      const store = await cookies();
      store.delete(MOCK_SESSION_COOKIE);
    },
  };
}