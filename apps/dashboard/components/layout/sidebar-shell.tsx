"use client";

import { useState, type PointerEvent } from "react";
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
  const [hovered, setHovered] = useState(false);
  const expanded = !collapsed || hovered;

  function handlePointerEnter(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse" && collapsed) setHovered(true);
  }

  function handlePointerLeave(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse") setHovered(false);
  }

  return (
    <>
      <Sidebar
        role={role}
        collapsed={!expanded}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
      />
      <SidebarToggle collapsed={collapsed} onToggle={toggleCollapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        {topbar}
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-6">{children}</main>
      </div>
    </>
  );
}
