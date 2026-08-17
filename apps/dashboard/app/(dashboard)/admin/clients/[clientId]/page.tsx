import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/get-current-user";
import {
  canManageClients,
  getAdAccountAdminData,
} from "@/lib/client-admin";
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
    redirect("/dashboard/admin/clients");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">{data.client.name}</h1>
        <p className="text-sm text-muted-foreground">
          مدیریت اکانت‌های تبلیغاتی {data.client.name}.
        </p>
      </div>
      <AdAccountManagement data={data} />
    </div>
  );
}