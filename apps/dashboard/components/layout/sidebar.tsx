"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Megaphone,
  Settings,
  Navigation,
} from "lucide-react";

const navItems = [
  { title: "داشبورد", href: "/dashboard", icon: LayoutDashboard },
  { title: "مشتریان", href: "/dashboard/clients", icon: Users },
  { title: "کمپین‌ها", href: "/dashboard/campaigns", icon: Megaphone },
  { title: "تنظیمات", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col border-l border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Navigation className="size-5" />
        </span>
        <div className="flex flex-col">
          <span className="text-sm font-bold">پنل متا ادز</span>
          <span className="text-xs text-muted-foreground">گزارش کمپین‌ها</span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "size-4.5 shrink-0",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground group-hover:text-sidebar-foreground"
                )}
              />
              {item.title}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
