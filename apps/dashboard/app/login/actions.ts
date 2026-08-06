"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MOCK_ROLE_COOKIE, type MockRole } from "@/lib/mock-auth";

export async function loginAsMockRole(role: MockRole) {
  const store = await cookies();
  store.set(MOCK_ROLE_COOKIE, role, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  redirect("/dashboard");
}

export async function logoutMock() {
  const store = await cookies();
  store.delete(MOCK_ROLE_COOKIE);
  redirect("/login");
}
