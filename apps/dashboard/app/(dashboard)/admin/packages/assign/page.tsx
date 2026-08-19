import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/get-current-user";
import {
  canManagePackages,
  getClientAssignmentData,
} from "@/lib/package-admin";
import { getDashboardLanguage } from "@/lib/i18n/language";
import { DASHBOARD_STRINGS } from "@/lib/i18n/strings";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { PackageAssignmentWorkflow } from "@/components/admin/package-assignment-workflow";

export default async function AdminPackageAssignPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }
  if (!canManagePackages(user)) {
    redirect("/dashboard");
  }

  const lang = await getDashboardLanguage();
  const t = DASHBOARD_STRINGS[lang];
  const { clients, packages } = await getClientAssignmentData();

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader title={t.adminAssignTitle} subtitle={t.adminAssignSubtitle} />
      <PackageAssignmentWorkflow clients={clients} packages={packages} />
    </div>
  );
}