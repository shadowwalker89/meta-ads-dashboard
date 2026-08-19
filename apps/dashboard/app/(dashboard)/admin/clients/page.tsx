import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/get-current-user";
import {
  canCreateClients,
  canManageClients,
  getClientAdminData,
} from "@/lib/client-admin";
import { getDashboardLanguage } from "@/lib/i18n/language";
import { DASHBOARD_STRINGS } from "@/lib/i18n/strings";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ClientManagement } from "@/components/admin/client-management";

export default async function AdminClientsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }
  if (!canManageClients(user)) {
    redirect("/dashboard");
  }

  const lang = await getDashboardLanguage();
  const t = DASHBOARD_STRINGS[lang];
  const { clients, packages } = await getClientAdminData(user);

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader title={t.adminClientsTitle} subtitle={t.adminClientsSubtitle} />
      <ClientManagement
        clients={clients}
        packages={packages}
        canCreate={canCreateClients(user)}
      />
    </div>
  );
}