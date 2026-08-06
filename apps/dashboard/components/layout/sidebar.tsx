"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Users, Megaphone, Settings } from "lucide-react";

const navItems = [
  { title: "داشبورد", href: "/dashboard", icon: LayoutDashboard },
  { title: "مشتریان", href: "/dashboard/clients", icon: Users },
  { title: "کمپین‌ها", href: "/dashboard/campaigns", icon: Megaphone },
  { title: "تنظیمات", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col border-l bg-background">
      <div className="flex h-16 items-center px-6 text-lg font-bold">
        پنل متا ادز
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
