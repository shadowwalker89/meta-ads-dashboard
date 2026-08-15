import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/get-current-user";
import { getKpiAdminPageData } from "@/lib/kpi-config";
import { KpiConfigurator } from "@/components/admin/kpi-configurator";

export default async function AdminKpiConfigPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }
  if (user.role !== "admin" && user.role !== "super_admin") {
    redirect("/dashboard");
  }

  const { clients, configs } = await getKpiAdminPageData(user);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">تنظیم KPI مشتریان</h1>
        <p className="text-sm text-muted-foreground">
          مشخص کنید هر مشتری کدام شاخص‌ها را در داشبورد خود ببیند.
        </p>
      </div>
      <KpiConfigurator clients={clients} configs={configs} />
    </div>
  );
}