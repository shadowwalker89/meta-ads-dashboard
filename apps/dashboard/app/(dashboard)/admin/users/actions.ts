"use server";

import { revalidatePath } from "next/cache";
import { getDashboardLanguage } from "@/lib/i18n/language";
import { provisionCurrentUser, type ProvisionApplicationUserInput } from "@/lib/user-provisioning";
import {
  setCurrentApplicationUserPassword,
  setCurrentApplicationUserStatus,
  updateCurrentApplicationUser,
  type SetApplicationUserPasswordInput,
  type SetApplicationUserStatusInput,
  type UpdateApplicationUserInput,
} from "@/lib/user-lifecycle";
import type { AppLanguage } from "@/lib/i18n/strings";

type UserActionResult =
  | { ok: true; auditRecorded: boolean }
  | { ok: false; error: string };

function messageForCode(code: string, lang: AppLanguage): string {
  const fa = lang === "fa";
  switch (code) {
    case "forbidden": return fa ? "شما اجازه انجام این کار را ندارید." : "You are not allowed to perform this action.";
    case "invalid_input": return fa ? "اطلاعات واردشده معتبر نیست." : "Please check the entered information.";
    case "duplicate_application_user": return fa ? "کاربری با این ایمیل از قبل وجود دارد." : "An application user with this email already exists.";
     case "duplicate_auth_user": return fa ? "این ایمیل در Supabase Auth از قبل وجود دارد و نیاز به پیوند صریح دارد." : "This email already exists in Supabase Auth and requires explicit linking.";
     case "auth_error": return fa ? "عملیات حساب احراز هویت انجام نشد." : "The authentication account could not be updated.";
     case "configuration_error": return fa ? "تنظیمات سرور برای مدیریت کاربران کامل نیست." : "User management is not configured on the server. Please contact an administrator.";
     case "application_error": return fa ? "ذخیره کاربر برنامه انجام نشد." : "The application user could not be saved.";
    case "not_found": return fa ? "کاربر یافت نشد." : "User not found.";
    case "protected_super_admin": return fa ? "این کاربر super_admin قابل ویرایش نیست." : "This super_admin cannot be edited.";
    case "self_deactivation": return fa ? "نمی‌توانید حساب خودتان را غیرفعال کنید." : "You cannot deactivate your own account.";
    case "last_admin": return fa ? "نمی‌توان آخرین ادمین فعال را غیرفعال کرد." : "The last active admin cannot be deactivated.";
    case "client_scope": return fa ? "به این مشتری دسترسی ندارید." : "This client is outside your scope.";
    case "unauthenticated": return fa ? "ابتدا وارد شوید." : "Please sign in first.";
    case "no_auth_identity": return fa ? "این کاربر حساب احراز هویت ندارد." : "This user does not have an authentication account.";
    default: return fa ? "عملیات انجام نشد." : "The operation could not be completed.";
  }
}

function codeFor(error: unknown): string {
  return error && typeof error === "object" && "code" in error
    ? String((error as { code: unknown }).code)
    : error && typeof error === "object" && "kind" in error
      ? String((error as { kind: unknown }).kind)
      : "unknown";
}

export async function createApplicationUser(input: ProvisionApplicationUserInput): Promise<UserActionResult> {
  const lang = await getDashboardLanguage();
  try {
    const result = await provisionCurrentUser(input);
    revalidatePath("/admin/users");
    return { ok: true, auditRecorded: result.auditRecorded };
  } catch (error) {
    return { ok: false, error: messageForCode(codeFor(error), lang) };
  }
}

export async function updateApplicationUser(input: UpdateApplicationUserInput): Promise<UserActionResult> {
  const lang = await getDashboardLanguage();
  try {
    const result = await updateCurrentApplicationUser(input);
    revalidatePath("/admin/users");
    return { ok: true, auditRecorded: result.auditRecorded };
  } catch (error) {
    return { ok: false, error: messageForCode(codeFor(error), lang) };
  }
}

export async function setApplicationUserStatus(input: SetApplicationUserStatusInput): Promise<UserActionResult> {
  const lang = await getDashboardLanguage();
  try {
    const result = await setCurrentApplicationUserStatus(input);
    revalidatePath("/admin/users");
    return { ok: true, auditRecorded: result.auditRecorded };
  } catch (error) {
    return { ok: false, error: messageForCode(codeFor(error), lang) };
  }
}

export async function setApplicationUserPassword(input: SetApplicationUserPasswordInput): Promise<UserActionResult> {
  const lang = await getDashboardLanguage();
  try {
    const result = await setCurrentApplicationUserPassword(input);
    revalidatePath("/admin/users");
    return { ok: true, auditRecorded: result.auditRecorded };
  } catch (error) {
    return { ok: false, error: messageForCode(codeFor(error), lang) };
  }
}
