import { cookies } from "next/headers";
import {
  DEFAULT_LANGUAGE,
  LANG_COOKIE,
  LANGUAGE_COOKIE_MAX_AGE,
  isAppLanguage,
  type AppLanguage,
} from "./strings";

/**
 * Server-side language resolution for the dashboard group. The
 * `dashboard-lang` cookie is the single source of truth so that both
 * the server layout (direction/font wrapper) and the client toggle
 * agree, and the choice survives refresh and navigation. Missing or
 * invalid values fall back to Persian (the product default).
 *
 * Server-only (uses next/headers) — never import this module from a
 * client component; the cookie constants live in strings.ts which is
 * client-safe.
 */
export {
  LANG_COOKIE,
  LANGUAGE_COOKIE_MAX_AGE,
  isAppLanguage,
};
export type { AppLanguage };

export async function getDashboardLanguage(): Promise<AppLanguage> {
  const store = await cookies();
  const value = store.get(LANG_COOKIE)?.value;
  return isAppLanguage(value) ? value : DEFAULT_LANGUAGE;
}