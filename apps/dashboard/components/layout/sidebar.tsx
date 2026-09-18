"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { UserRole } from "@repo/shared";
import { useDashboardLang } from "@/components/layout/language-provider";
import { buildNavItems } from "@/lib/navigation";
import {
  Navigation,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

const SIDEBAR_STORAGE_KEY = "dashboard:sidebar-collapsed";

export function useSidebarState() {
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (saved === "false") setCollapsed(false);
    } catch {
    }
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
    } catch {
    }
  };

  return { collapsed, toggleCollapsed };
}

export function SidebarToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { strings: t } = useDashboardLang();

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={collapsed ? t.sidebarToggleExpand : t.sidebarToggleCollapse}
      title={collapsed ? t.sidebarToggleExpand : t.sidebarToggleCollapse}
      className={cn(
        "fixed bottom-4 start-4 z-50 flex items-center gap-2 rounded-full border border-sidebar-border bg-sidebar px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 shadow-md transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:bottom-6 md:start-5",
        !collapsed && "md:start-5"
      )}
    >
      {collapsed ? (
        <PanelLeftOpen className="size-4 shrink-0" />
      ) : (
        <PanelLeftClose className="size-4 shrink-0" />
      )}
      {!collapsed ? (
        <span className="hidden md:inline">{t.sidebarToggleCollapse}</span>
      ) : null}
    </button>
  );
}

export function Sidebar({
  role,
  collapsed,
}: {
  role: UserRole;
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const { strings: t } = useDashboardLang();
  const navItems = buildNavItems(role, t);

  return (
    <aside
      className={cn(
        "hidden shrink-0 overflow-hidden md:flex md:flex-col border-e border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "md:w-16" : "md:w-64"
      )}
    >
      <div
        className={cn(
          "flex h-14 items-center gap-3 border-b border-sidebar-border",
          collapsed ? "justify-center px-0" : "px-6"
        )}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Navigation className="size-5" />
        </span>
        {!collapsed ? (
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-bold">{t.brandTitle}</span>
            <span className="truncate text-xs text-muted-foreground">
              {t.brandTagline}
            </span>
          </div>
        ) : null}
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.title : undefined}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg text-sm font-medium transition-colors",
                collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5",
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
              {!collapsed ? item.title : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}