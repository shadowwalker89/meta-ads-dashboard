import { ModeToggle } from "@/components/mode-toggle";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { logoutMock } from "@/app/login/actions";
import type { MockRole } from "@/lib/mock-auth";

const roleLabels: Record<MockRole, string> = {
  super_admin: "مدیر کل",
  admin: "ادمین",
  client: "مشتری",
};

export function Topbar({ role }: { role: MockRole }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur supports-backdrop-filter sm:px-6">
      <div className="flex items-center gap-3">
        <MobileNav />
        <span className="text-sm text-muted-foreground">
          خوش آمدید،{" "}
          <span className="font-medium text-foreground">{roleLabels[role]}</span>
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <ModeToggle />
        <form action={logoutMock}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-destructive"
          >
            <LogOut className="size-4" />
            خروج
          </Button>
        </form>
      </div>
    </header>
  );
}
