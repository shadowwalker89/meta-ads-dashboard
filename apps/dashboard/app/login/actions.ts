"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthProvider, getAuthUserMapper } from "@/lib/auth";
import {
  authenticateActiveUser,
  loginFailureMessage,
} from "@/lib/auth/login";
import {
  DEFAULT_LANGUAGE,
  isAppLanguage,
  LANG_COOKIE,
} from "@/lib/i18n/strings";

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

  const failure = await authenticateActiveUser(
    getAuthProvider(),
    getAuthUserMapper(),
    { email, password: password || undefined }
  );
  if (failure) {
    const language = (await cookies()).get(LANG_COOKIE)?.value;
    return {
      error: loginFailureMessage(
        failure,
        isAppLanguage(language) ? language : DEFAULT_LANGUAGE
      ),
    };
  }
  redirect("/dashboard");
}

export async function signOut() {
  const provider = getAuthProvider();
  await provider.signOut();
  redirect("/login");
}
