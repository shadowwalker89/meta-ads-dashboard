"use client";

import type { UserRole } from "@repo/shared";
import { Sidebar, SidebarToggle, useSidebarState } from "@/components/layout/sidebar";

export function SidebarShell({
  role,
  topbar,
  children,
}: {
  role: UserRole;
  topbar: React.ReactNode;
  children: React.ReactNode;
}) {
  const { collapsed, toggleCollapsed } = useSidebarState();

  return (
    <>
      <Sidebar role={role} collapsed={collapsed} />
      <SidebarToggle collapsed={collapsed} onToggle={toggleCollapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        {topbar}
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-6">{children}</main>
      </div>
    </>
  );
}
