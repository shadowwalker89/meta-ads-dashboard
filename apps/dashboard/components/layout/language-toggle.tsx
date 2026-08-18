"use client";

import { Check, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDashboardLang } from "@/components/layout/language-provider";

/**
 * Language switcher for the dashboard topbar. Reads/writes the shared
 * dashboard language through the provider (which persists it in the
 * `dashboard-lang` cookie) — this component is only a convenience
 * entry point, never the source of truth.
 */
export function LanguageToggle() {
  const { lang, setLang, strings: t } = useDashboardLang();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={t.languageLabel}
          title={t.languageLabel}
        >
          <Globe className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">{t.languageLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => setLang("fa")}
          className="gap-2"
          aria-current={lang === "fa" ? "true" : undefined}
        >
          <span className="flex size-4 shrink-0 items-center justify-center">
            {lang === "fa" ? <Check className="size-4" /> : null}
          </span>
          فارسی
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLang("en")}
          className="gap-2"
          aria-current={lang === "en" ? "true" : undefined}
        >
          <span className="flex size-4 shrink-0 items-center justify-center">
            {lang === "en" ? <Check className="size-4" /> : null}
          </span>
          English
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}