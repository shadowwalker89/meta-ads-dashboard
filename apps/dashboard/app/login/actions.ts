"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MOCK_SESSION_COOKIE, type MockRole } from "@/lib/mock-auth";

export async function loginAsMockUser(userId: string, role: MockRole) {
  const store = await cookies();
  store.set(
    MOCK_SESSION_COOKIE,
    JSON.stringify({ userId, role }),
    {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    }
  );
  redirect("/dashboard");
}

export async function logoutMock() {
  const store = await cookies();
  store.delete(MOCK_SESSION_COOKIE);
  redirect("/login");
}