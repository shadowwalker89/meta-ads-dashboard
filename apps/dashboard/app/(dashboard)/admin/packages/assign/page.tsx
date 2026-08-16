import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/get-current-user";
import {
  canManagePackages,
  getClientAssignmentData,
} from "@/lib/package-admin";
import { PackageAssignmentWorkflow } from "@/components/admin/package-assignment-workflow";

export default async function AdminPackageAssignPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }
  if (!canManagePackages(user)) {
    redirect("/dashboard");
  }

  const { clients, packages } = await getClientAssignmentData();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">اختصاص پکیج به مشتری</h1>
        <p className="text-sm text-muted-foreground">
          پس از انتساب، پیش‌فرض‌های قیمت‌گذاری پکیج به‌صورت خودکار به مشتری
          منتقل می‌شوند.
        </p>
      </div>
      <PackageAssignmentWorkflow clients={clients} packages={packages} />
    </div>
  );
}