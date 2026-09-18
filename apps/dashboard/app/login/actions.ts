"use server";

import { redirect } from "next/navigation";
import { getAuthProvider } from "@/lib/auth";

export type SignInResult = { error: string } | undefined;

export async function signIn(email: string) {
  const provider = getAuthProvider();
  await provider.signIn({ email });
  redirect("/dashboard");
}

export async function signInWithPassword(
  _previousState: SignInResult,
  formData: FormData
): Promise<SignInResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !email.includes("@")) {
    return { error: "ایمیل معتبر وارد کنید." };
  }

  try {
    await getAuthProvider().signIn({
      email,
      password: password || undefined,
    });
  } catch {
    return { error: "ایمیل یا رمز عبور نادرست است." };
  }
  redirect("/dashboard");
}

export async function signOut() {
  const provider = getAuthProvider();
  await provider.signOut();
  redirect("/login");
}
