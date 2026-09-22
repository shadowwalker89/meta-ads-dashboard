"use server";

import { revalidatePath } from "next/cache";
import { getDashboardLanguage } from "@/lib/i18n/language";
import { provisionCurrentUser, type ProvisionApplicationUserInput } from "@/lib/user-provisioning";
import type { AppLanguage } from "@/lib/i18n/strings";

type UserActionResult =
  | { ok: true; auditRecorded: boolean }
  | { ok: false; error: string };

function messageForCode(code: string, lang: AppLanguage): string {
  const fa = lang === "fa";
  switch (code) {
    case "forbidden": return fa ? "شما اجازه ایجاد این کاربر را ندارید." : "You are not allowed to create this user.";
    case "invalid_input": return fa ? "اطلاعات واردشده معتبر نیست." : "Please check the entered information.";
    case "duplicate_application_user": return fa ? "کاربری با این ایمیل از قبل وجود دارد." : "An application user with this email already exists.";
    case "duplicate_auth_user": return fa ? "این ایمیل در Supabase Auth از قبل وجود دارد و نیاز به پیوند صریح دارد." : "This email already exists in Supabase Auth and requires explicit linking.";
    case "auth_error": return fa ? "ایجاد حساب احراز هویت انجام نشد." : "The authentication account could not be created.";
    case "application_error": return fa ? "ذخیره کاربر برنامه انجام نشد." : "The application user could not be saved.";
    default: return fa ? "ایجاد کاربر انجام نشد." : "The user could not be created.";
  }
}

export async function createApplicationUser(
  input: ProvisionApplicationUserInput
): Promise<UserActionResult> {
  const lang = await getDashboardLanguage();
  try {
    const result = await provisionCurrentUser(input);
    revalidatePath("/admin/users");
    return { ok: true, auditRecorded: result.auditRecorded };
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: unknown }).code)
        : error && typeof error === "object" && "kind" in error
          ? String((error as { kind: unknown }).kind)
          : "unknown";
    return {
      ok: false,
      error: code === "unauthenticated" ? (lang === "fa" ? "ابتدا وارد شوید." : "Please sign in first.") : messageForCode(code, lang),
    };
  }
}
