"use client";

import type { CampaignAdminData } from "@/lib/campaign-admin";
import { useDashboardLang } from "@/components/layout/language-provider";
import { AdminClientSelect } from "@/components/admin/admin-client-select";
import { CampaignOwnershipList } from "@/components/admin/campaign-ownership-list";

/**
 * Client container for the Campaign Ownership page. Owns only the shared
 * client selector; every per-campaign control and its authorization live in
 * the server actions. Campaign ownership math is never recomputed here.
 */
export function CampaignOwnershipManagement({
  data,
}: {
  data: CampaignAdminData;
}) {
  const { strings: t } = useDashboardLang();

  return (
    <div className="flex flex-col gap-6">
      <AdminClientSelect
        clients={data.clients}
        selectedClientId={data.selectedClientId}
        baseHref="/admin/campaigns"
      />

      {data.selectedClientId === null ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground">
          {t.campaignOwnershipNoClient}
        </div>
      ) : (
        <CampaignOwnershipList
          campaigns={data.campaigns}
          clients={data.clients}
        />
      )}
    </div>
  );
}