import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/get-current-user";
import {
  canManagePackages,
  getPackageManagementData,
} from "@/lib/package-admin";
import { PackageManagement } from "@/components/admin/package-management";

export default async function AdminPackagesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }
  if (!canManagePackages(user)) {
    redirect("/dashboard");
  }

  const packages = await getPackageManagementData();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">مدیریت پکیج‌ها</h1>
        <p className="text-sm text-muted-foreground">
          پکیج‌ها داده‌های قابل ویرایش هستند؛ تنظیمات از طریق اعتبارسنجی مشترک
          ذخیره و پاک‌سازی می‌شوند.
        </p>
      </div>
      <PackageManagement packages={packages} />
    </div>
  );
}