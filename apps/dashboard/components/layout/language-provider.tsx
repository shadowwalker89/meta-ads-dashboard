"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  DASHBOARD_STRINGS,
  LANG_COOKIE,
  LANGUAGE_COOKIE_MAX_AGE,
  type AppLanguage,
  type DashboardStrings,
} from "@/lib/i18n/strings";

export interface LanguageContextValue {
  /** The active dashboard language. */
  lang: AppLanguage;
  /** Text direction for the dashboard group ("fa" → rtl, "en" → ltr). */
  dir: "rtl" | "ltr";
  /** The string dictionary for the active language. */
  strings: DashboardStrings;
  /** Switches the language: updates the cookie + client state and tells
   *  the server to re-render so server components pick up the new value. */
  setLang: (lang: AppLanguage) => void;
}

/**
 * Default context used when a component renders OUTSIDE the provider
 * (e.g. static server-rendered tests): Persian/RTL, the Persian
 * dictionary, and a no-op setter. This keeps every dashboard component
 * safe to render without a provider while the product default stays fa.
 */
const DEFAULT_CONTEXT: LanguageContextValue = {
  lang: "fa",
  dir: "rtl",
  strings: DASHBOARD_STRINGS.fa,
  setLang: () => {},
};

const LanguageContext = createContext<LanguageContextValue>(DEFAULT_CONTEXT);

/**
 * Reads the dashboard language from context. Falls back to the Persian
 * default when no provider is present (e.g. renderToStaticMarkup tests),
 * so components never crash and the fa default is preserved.
 */
export function useDashboardLang(): LanguageContextValue {
  return useContext(LanguageContext);
}

/**
 * Client language provider for the dashboard group. Owns the `dir`/
 * `lang`/font wrapper so direction and typeface flip with the selected
 * language, and persists the choice in the `dashboard-lang` cookie
 * (the single source of truth the server layout reads).
 */
export function LanguageProvider({
  lang: initialLang,
  children,
}: {
  lang: AppLanguage;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [lang, setLangState] = useState<AppLanguage>(initialLang);
  const dir: "rtl" | "ltr" = lang === "fa" ? "rtl" : "ltr";
  const strings = DASHBOARD_STRINGS[lang];

  const setLang = useCallback(
    (next: AppLanguage) => {
      setLangState(next);
      document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=${LANGUAGE_COOKIE_MAX_AGE}; samesite=lax`;
      router.refresh();
    },
    [router]
  );

  const value = useMemo(
    () => ({ lang, dir, strings, setLang }),
    [lang, dir, strings, setLang]
  );

  return (
    <LanguageContext.Provider value={value}>
      <div
        dir={dir}
        lang={lang}
        className={cn("flex min-h-screen", lang === "en" && "font-en")}
      >
        {children}
      </div>
    </LanguageContext.Provider>
  );
}