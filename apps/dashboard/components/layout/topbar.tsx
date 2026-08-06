import { ModeToggle } from "@/components/mode-toggle";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Button } from "@/components/ui/button";
import { logoutMock } from "@/app/login/actions";
import type { MockRole } from "@/lib/mock-auth";

const roleLabels: Record<MockRole, string> = {
  super_admin: "مدیر کل",
  admin: "ادمین",
  client: "مشتری",
};

export function Topbar({ role }: { role: MockRole }) {
  return (
    <header className="flex h-16 items-center justify-between border-b px-6">
      <div className="flex items-center gap-3">
        <MobileNav />
        <span className="text-sm text-muted-foreground">
          خوش آمدید ({roleLabels[role]})
        </span>
      </div>
      <div className="flex items-center gap-3">
        <ModeToggle />
        <form action={logoutMock}>
          <Button type="submit" variant="ghost" size="sm">
            خروج
          </Button>
        </form>
      </div>
    </header>
  );
}
