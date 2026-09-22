import { requirePageAccess } from "@/lib/access";
import { getDashboardLanguage } from "@/lib/i18n/language";
import { DASHBOARD_STRINGS } from "@/lib/i18n/strings";
import { getUserAdminData } from "@/lib/user-admin";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { UserManagement } from "@/components/admin/user-management";

export default async function AdminUsersPage() {
  await requirePageAccess("admin", "super_admin");
  const lang = await getDashboardLanguage();
  const t = DASHBOARD_STRINGS[lang];
  const data = await getUserAdminData();

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader title={t.adminUsersTitle} subtitle={t.adminUsersSubtitle} />
      <UserManagement data={data} />
    </div>
  );
}
