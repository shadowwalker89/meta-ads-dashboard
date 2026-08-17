import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/get-current-user";
import {
  canCreateClients,
  canManageClients,
  getClientAdminData,
} from "@/lib/client-admin";
import { ClientManagement } from "@/components/admin/client-management";

export default async function AdminClientsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }
  if (!canManageClients(user)) {
    redirect("/dashboard");
  }

  const { clients, packages } = await getClientAdminData(user);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">مدیریت مشتریان</h1>
        <p className="text-sm text-muted-foreground">
          مشتریان، پکیج اختصاص‌داده‌شده و اکانت‌های تبلیغاتی آن‌ها را مدیریت کنید.
        </p>
      </div>
      <ClientManagement
        clients={clients}
        packages={packages}
        canCreate={canCreateClients(user)}
      />
    </div>
  );
}