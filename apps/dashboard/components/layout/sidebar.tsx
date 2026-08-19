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

/**
 * Persisted preference for the collapsible desktop sidebar. Only the
 * collapsed/expanded choice is stored (localStorage) — never auth or
 * data. Absent/reading failures keep the collapsed default, which is
 * also the initial render value so server/client markup never diverge.
 */
const SIDEBAR_STORAGE_KEY = "dashboard:sidebar-collapsed";

/**
 * Desktop sidebar. Collapses to an icon rail (default) with native
 * tooltips; the bottom toggle expands it to a full menu. The width
 * transition is purely cosmetic — navigation is plain links and every
 * item keeps its accessible label in both states.
 */
export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const { strings: t } = useDashboardLang();
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (saved === "false") setCollapsed(false);
    } catch {
      // Storage unavailable (private mode) → keep the collapsed default.
    }
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
    } catch {
      // Storage unavailable — the in-memory state still applies.
    }
  };

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

      <div className="border-t border-sidebar-border p-3">
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? t.sidebarToggleExpand : t.sidebarToggleCollapse}
          title={collapsed ? t.sidebarToggleExpand : t.sidebarToggleCollapse}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2"
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4.5 shrink-0" />
          ) : (
            <PanelLeftClose className="size-4.5 shrink-0" />
          )}
          {!collapsed ? t.sidebarToggleCollapse : null}
        </button>
      </div>
    </aside>
  );
}