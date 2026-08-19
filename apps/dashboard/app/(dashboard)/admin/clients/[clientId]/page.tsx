import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/get-current-user";
import {
  canManageClients,
  getAdAccountAdminData,
} from "@/lib/client-admin";
import { getDashboardLanguage } from "@/lib/i18n/language";
import { DASHBOARD_STRINGS, tpl } from "@/lib/i18n/strings";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdAccountManagement } from "@/components/admin/ad-account-management";

interface AdminClientDetailPageProps {
  params: Promise<{ clientId: string }>;
}

export default async function AdminClientDetailPage({
  params,
}: AdminClientDetailPageProps) {
  const user = await getCurrentUser();
  const { clientId } = await params;

  if (!user) {
    redirect("/login");
  }
  if (!canManageClients(user)) {
    redirect("/dashboard");
  }

  let data;
  try {
    data = await getAdAccountAdminData(user, clientId);
  } catch {
    redirect("/admin/clients");
  }

  const lang = await getDashboardLanguage();
  const t = DASHBOARD_STRINGS[lang];

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        title={data.client.name}
        subtitle={tpl(t.adminClientDetailSubtitle, { name: data.client.name })}
      />
      <AdAccountManagement data={data} />
    </div>
  );
}