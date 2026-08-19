import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/get-current-user";
import { getKpiAdminPageData } from "@/lib/kpi-config";
import { getDashboardLanguage } from "@/lib/i18n/language";
import { DASHBOARD_STRINGS } from "@/lib/i18n/strings";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { KpiConfigurator } from "@/components/admin/kpi-configurator";

export default async function AdminKpiConfigPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }
  if (user.role !== "admin" && user.role !== "super_admin") {
    redirect("/dashboard");
  }

  const lang = await getDashboardLanguage();
  const t = DASHBOARD_STRINGS[lang];
  const { clients, configs } = await getKpiAdminPageData(user);

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader title={t.adminKpiConfigTitle} subtitle={t.adminKpiConfigSubtitle} />
      <KpiConfigurator clients={clients} configs={configs} />
    </div>
  );
}