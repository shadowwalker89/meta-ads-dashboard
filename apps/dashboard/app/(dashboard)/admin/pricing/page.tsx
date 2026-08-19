import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/get-current-user";
import {
  canViewPricing,
  getClientPricingVerification,
  getPricingAdminClients,
} from "@/lib/pricing-admin";
import { requireClientAccess } from "@/lib/access";
import { getDashboardLanguage } from "@/lib/i18n/language";
import { DASHBOARD_STRINGS } from "@/lib/i18n/strings";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminClientSelect } from "@/components/admin/admin-client-select";
import { PricingVerificationTable } from "@/components/admin/pricing-verification-table";

interface AdminPricingPageProps {
  searchParams: Promise<{ clientId?: string }>;
}

export default async function AdminPricingPage({
  searchParams,
}: AdminPricingPageProps) {
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

  const verification = selectedClientId
    ? await getClientPricingVerification(selectedClientId)
    : null;

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        title={t.adminPricingTitle}
        subtitle={t.adminPricingSubtitle}
        meta={
          <AdminClientSelect
            clients={clients}
            selectedClientId={selectedClientId}
            baseHref="/admin/pricing"
          />
        }
      />

      {verification ? (
        <PricingVerificationTable verification={verification} />
      ) : (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground">
          {t.pricingSelectClientPrompt}
        </div>
      )}
    </div>
  );
}