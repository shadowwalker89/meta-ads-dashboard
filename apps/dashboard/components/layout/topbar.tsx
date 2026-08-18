import { ModeToggle } from "@/components/mode-toggle";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/login/actions";
import { getDashboardLanguage } from "@/lib/i18n/language";
import { DASHBOARD_STRINGS } from "@/lib/i18n/strings";
import type { UserRole } from "@repo/shared";

export async function Topbar({
  fullName,
  role,
}: {
  fullName: string;
  role: UserRole;
}) {
  const lang = await getDashboardLanguage();
  const t = DASHBOARD_STRINGS[lang];

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b bg-background/80 px-4 backdrop-blur supports-backdrop-filter sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <MobileNav role={role} />
        <span className="truncate text-sm text-muted-foreground">
          {t.welcome}{" "}
          <span className="font-medium text-foreground">{fullName}</span>
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <LanguageToggle />
        <ModeToggle />
        <form action={signOut}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-destructive"
          >
            <LogOut className="size-4" />
            {t.signOut}
          </Button>
        </form>
      </div>
    </header>
  );
}