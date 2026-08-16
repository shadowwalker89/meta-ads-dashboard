import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/get-current-user";
import {
  canViewPricing,
  getClientPricingConfigData,
  getPricingAdminClients,
} from "@/lib/pricing-admin";
import { requireClientAccess } from "@/lib/access";
import { PricingClientSelect } from "@/components/admin/pricing-client-select";
import { PricingConfigurator } from "@/components/admin/pricing-configurator";

interface AdminPricingConfigPageProps {
  searchParams: Promise<{ clientId?: string }>;
}

export default async function AdminPricingConfigPage({
  searchParams,
}: AdminPricingConfigPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }
  if (!canViewPricing(user)) {
    redirect("/dashboard");
  }

  const clients = await getPricingAdminClients();
  const { clientId } = await searchParams;
  const selectedClientId =
    clientId && clients.some((c) => c.id === clientId) ? clientId : null;

  // The clientId arrives from request input (searchParams); even though
  // this surface is super_admin-only, it still passes through the central
  // tenant-access boundary.
  if (selectedClientId) {
    await requireClientAccess(user, selectedClientId);
  }

  const config = selectedClientId
    ? await getClientPricingConfigData(selectedClientId)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">تنظیم قیمت‌گذاری</h1>
        <p className="text-sm text-muted-foreground">
          برای هر متریک، یک قانون مؤثر جدید تعریف کنید. قوانین فقط اضافه
          می‌شوند و هرگز تغییر یا حذف نمی‌شوند.
        </p>
      </div>

      <PricingClientSelect
        clients={clients}
        selectedClientId={selectedClientId}
        baseHref="/dashboard/admin/pricing/config"
      />

      {config ? (
        <PricingConfigurator
          clientId={config.clientId}
          clientName={config.clientName}
          config={config}
        />
      ) : (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground">
          برای تنظیم قیمت‌گذاری، ابتدا یک مشتری انتخاب کنید.
        </div>
      )}
    </div>
  );
}