import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/get-current-user";
import {
  canViewPricing,
  getClientPricingVerification,
  getPricingAdminClients,
} from "@/lib/pricing-admin";
import { requireClientAccess } from "@/lib/access";
import { PricingClientSelect } from "@/components/admin/pricing-client-select";
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">بررسی قیمت‌گذاری</h1>
        <p className="text-sm text-muted-foreground">
          مسیر کامل قیمت‌گذاری: ارزش خام متا ← قانون قیمت‌گذاری ← ارزش مشتری
        </p>
      </div>

      <PricingClientSelect clients={clients} selectedClientId={selectedClientId} />

      {verification ? (
        <PricingVerificationTable verification={verification} />
      ) : (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground">
          برای مشاهده‌ی قیمت‌گذاری، ابتدا یک مشتری انتخاب کنید.
        </div>
      )}
    </div>
  );
}