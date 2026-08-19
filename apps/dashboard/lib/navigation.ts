import type { LucideIcon } from "lucide-react";
import {
  ArrowRightLeft,
  BadgeDollarSign,
  Gauge,
  LayoutDashboard,
  Package,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import type { UserRole } from "@repo/shared";
import type { DashboardStrings } from "@/lib/i18n/strings";

/**
 * The single source of truth for the sidebar / mobile-nav item list.
 *
 * Both the desktop collapsible sidebar and the mobile sheet render from
 * this builder so the Client and Admin dashboards (they share the same
 * `(dashboard)` route-group layout) can never drift apart. Role-gated
 * items are computed here — never duplicated in a component.
 */
export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

export function buildNavItems(
  role: UserRole,
  t: DashboardStrings
): NavItem[] {
  const isManager = role === "admin" || role === "super_admin";
  const isSuperAdmin = role === "super_admin";

  return [
    { title: t.navDashboard, href: "/dashboard", icon: LayoutDashboard },
    ...(isManager
      ? [{ title: t.navAdminOverview, href: "/admin", icon: Gauge }]
      : []),
    ...(isManager
      ? [{ title: t.navKpiConfig, href: "/admin/kpi-config", icon: SlidersHorizontal }]
      : []),
    ...(isManager
      ? [{ title: t.navClients, href: "/admin/clients", icon: Users }]
      : []),
    ...(isSuperAdmin
      ? [
          { title: t.navPackages, href: "/admin/packages", icon: Package },
          {
            title: t.navAssignPackage,
            href: "/admin/packages/assign",
            icon: ArrowRightLeft,
          },
          {
            title: t.navPricingReview,
            href: "/admin/pricing",
            icon: BadgeDollarSign,
          },
          {
            title: t.navPricingConfig,
            href: "/admin/pricing/config",
            icon: BadgeDollarSign,
          },
        ]
      : []),
  ];
}