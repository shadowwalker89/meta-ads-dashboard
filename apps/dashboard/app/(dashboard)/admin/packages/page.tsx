import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/get-current-user";
import {
  canManagePackages,
  getPackageManagementData,
} from "@/lib/package-admin";
import { getDashboardLanguage } from "@/lib/i18n/language";
import { DASHBOARD_STRINGS } from "@/lib/i18n/strings";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { PackageManagement } from "@/components/admin/package-management";

export default async function AdminPackagesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }
  if (!canManagePackages(user)) {
    redirect("/dashboard");
  }

  const lang = await getDashboardLanguage();
  const t = DASHBOARD_STRINGS[lang];
  const packages = await getPackageManagementData();

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader title={t.adminPackagesTitle} subtitle={t.adminPackagesSubtitle} />
      <PackageManagement packages={packages} />
    </div>
  );
}