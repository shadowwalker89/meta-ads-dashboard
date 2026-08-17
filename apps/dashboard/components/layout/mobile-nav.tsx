"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { UserRole } from "@repo/shared";
import {
  Menu,
  LayoutDashboard,
  Users,
  Navigation,
  SlidersHorizontal,
  BadgeDollarSign,
  Package,
  ArrowRightLeft,
} from "lucide-react";

export function MobileNav({ role }: { role: UserRole }) {
  const pathname = usePathname();

  const navItems = [
    { title: "داشبورد", href: "/dashboard", icon: LayoutDashboard },
    ...(role === "admin" || role === "super_admin"
      ? [
          {
            title: "تنظیم KPI مشتریان",
            href: "/dashboard/admin/kpi-config",
            icon: SlidersHorizontal,
          },
          {
            title: "مدیریت مشتریان",
            href: "/dashboard/admin/clients",
            icon: Users,
          },
        ]
      : []),
    ...(role === "super_admin"
      ? [
          {
            title: "مدیریت پکیج‌ها",
            href: "/dashboard/admin/packages",
            icon: Package,
          },
          {
            title: "اختصاص پکیج",
            href: "/dashboard/admin/packages/assign",
            icon: ArrowRightLeft,
          },
          {
            title: "بررسی قیمت‌گذاری",
            href: "/dashboard/admin/pricing",
            icon: BadgeDollarSign,
          },
          {
            title: "تنظیم قیمت‌گذاری",
            href: "/dashboard/admin/pricing/config",
            icon: BadgeDollarSign,
          },
        ]
      : []),
  ];

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="bg-sidebar text-sidebar-foreground"
      >
        <SheetHeader className="border-b border-sidebar-border">
          <SheetTitle className="flex items-center gap-3 text-foreground">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Navigation className="size-5" />
            </span>
            پنل متا ادز
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 p-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="size-4.5 shrink-0" />
                {item.title}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
