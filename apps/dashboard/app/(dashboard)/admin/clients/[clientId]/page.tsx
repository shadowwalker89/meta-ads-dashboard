import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
      <Link
        href="/admin/clients"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm w-fit"
      >
        <ArrowRight className="size-4" />
        {t.backToClients}
      </Link>
      <AdminPageHeader
        title={data.client.name}
        subtitle={tpl(t.adminClientDetailSubtitle, { name: data.client.name })}
      />
      <AdAccountManagement data={data} />
    </div>
  );
}