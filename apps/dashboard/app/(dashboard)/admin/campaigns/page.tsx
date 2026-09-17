import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/get-current-user";
import {
  canManageCampaignOwnership,
  getCampaignAdminData,
} from "@/lib/campaign-admin";
import { getDashboardLanguage } from "@/lib/i18n/language";
import { DASHBOARD_STRINGS } from "@/lib/i18n/strings";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { CampaignOwnershipManagement } from "@/components/admin/campaign-ownership-management";

export default async function AdminCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }
  if (!canManageCampaignOwnership(user)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const requestedClientId =
    typeof params.clientId === "string" && params.clientId.length > 0
      ? params.clientId
      : null;

  const lang = await getDashboardLanguage();
  const t = DASHBOARD_STRINGS[lang];
  const data = await getCampaignAdminData(user, requestedClientId);

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        title={t.campaignOwnershipTitle}
        subtitle={t.campaignOwnershipDescription}
      />
      <CampaignOwnershipManagement data={data} />
    </div>
  );
}