import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/get-current-user";
import {
  canViewPricing,
  getClientPricingConfigData,
  getPricingAdminClients,
} from "@/lib/pricing-admin";
import { requireClientAccess } from "@/lib/access";
import { getDashboardLanguage } from "@/lib/i18n/language";
import { DASHBOARD_STRINGS } from "@/lib/i18n/strings";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminClientSelect } from "@/components/admin/admin-client-select";
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

  const lang = await getDashboardLanguage();
  const t = DASHBOARD_STRINGS[lang];
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
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        title={t.adminPricingConfigTitle}
        subtitle={t.adminPricingConfigSubtitle}
        meta={
          <AdminClientSelect
            clients={clients}
            selectedClientId={selectedClientId}
            baseHref="/admin/pricing/config"
          />
        }
      />

      {config ? (
        <PricingConfigurator
          clientId={config.clientId}
          clientName={config.clientName}
          config={config}
        />
      ) : (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground">
          {t.pricingConfigSelectClientPrompt}
        </div>
      )}
    </div>
  );
}