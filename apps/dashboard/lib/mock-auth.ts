import { cookies } from "next/headers";

export type MockRole = "super_admin" | "admin" | "client";

export const MOCK_ROLE_COOKIE = "mock-role";

export async function getMockRole(): Promise<MockRole | null> {
  const store = await cookies();
  const value = store.get(MOCK_ROLE_COOKIE)?.value;

  if (value === "super_admin" || value === "admin" || value === "client") {
    return value;
  }

  return null;
}
