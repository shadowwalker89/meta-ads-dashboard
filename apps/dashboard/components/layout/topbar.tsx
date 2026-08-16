import { ModeToggle } from "@/components/mode-toggle";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/login/actions";

export function Topbar({ fullName }: { fullName: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur supports-backdrop-filter sm:px-6">
      <div className="flex items-center gap-3">
        <MobileNav />
        <span className="text-sm text-muted-foreground">
          خوش آمدید،{" "}
          <span className="font-medium text-foreground">{fullName}</span>
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <ModeToggle />
        <form action={signOut}>
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