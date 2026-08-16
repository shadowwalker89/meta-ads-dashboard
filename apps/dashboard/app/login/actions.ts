"use server";

import { redirect } from "next/navigation";
import { getAuthProvider } from "@/lib/auth";

/**
 * Provider-agnostic sign-in. The provider resolves the email to an
 * application User (mock: seeded account only) and records the session.
 */
export async function signIn(email: string) {
  const provider = getAuthProvider();
  await provider.signIn({ email });
  redirect("/dashboard");
}

export async function signOut() {
  const provider = getAuthProvider();
  await provider.signOut();
  redirect("/login");
}