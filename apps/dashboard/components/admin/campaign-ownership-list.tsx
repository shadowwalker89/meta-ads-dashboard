"use client";

import { useState } from "react";
import type {
  CampaignAdminEntry,
  CampaignClientOption,
} from "@/lib/campaign-admin";
import { Button } from "@/components/ui/button";
import { useDashboardLang } from "@/components/layout/language-provider";
import type { DashboardStrings } from "@/lib/i18n/strings";
import {
  assignCampaign,
  deactivateCampaignAssignment,
} from "@/app/(dashboard)/admin/campaigns/actions";

const OWNERSHIP_STYLES: Record<CampaignAdminEntry["ownership"], string> = {
  assigned: "bg-primary/15 text-primary",
  inherited: "bg-muted text-muted-foreground",
};

/**
 * Presentational. One row per campaign with its current effective owner, the
 * ownership source, a target-client select and the assign/change/deactivate
 * controls. All mutations go through the server actions — this component
 * never touches a repository and never derives ownership itself.
 */
export function CampaignOwnershipList({
  campaigns,
  clients,
}: {
  campaigns: CampaignAdminEntry[];
  clients: CampaignClientOption[];
}) {
  const { strings: t } = useDashboardLang();

  if (campaigns.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground">
        {t.campaignOwnershipEmpty}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[52rem] text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-start font-medium">
              {t.campaignTableCampaign}
            </th>
            <th className="px-3 py-2 text-start font-medium">
              {t.campaignTableSource}
            </th>
            <th className="px-3 py-2 text-start font-medium">
              {t.campaignTableEffectiveOwner}
            </th>
            <th className="px-3 py-2 text-start font-medium">
              {t.campaignTableTarget}
            </th>
            <th className="px-3 py-2 text-start font-medium" />
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => (
            <CampaignOwnershipRow
              key={campaign.id}
              campaign={campaign}
              clients={clients}
              strings={t}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CampaignOwnershipRow({
  campaign,
  clients,
  strings: t,
}: {
  campaign: CampaignAdminEntry;
  clients: CampaignClientOption[];
  strings: DashboardStrings;
}) {
  const [targetClientId, setTargetClientId] = useState("");
  const [busy, setBusy] = useState<"assign" | "deactivate" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const ownershipLabel =
    campaign.ownership === "assigned"
      ? t.campaignOwnershipExplicit
      : t.campaignOwnershipInherited;

  async function handleAssign() {
    setBusy("assign");
    setFeedback(null);
    const result = await assignCampaign(campaign.id, targetClientId);
    setBusy(null);
    if (result.ok) {
      setFeedback(
        result.value.changed
          ? t.campaignChangedSuccess
          : t.campaignAssignedSuccess
      );
      setTargetClientId("");
    } else {
      setFeedback(result.error);
    }
  }

  async function handleDeactivate() {
    setBusy("deactivate");
    setFeedback(null);
    const result = await deactivateCampaignAssignment(campaign.id);
    setBusy(null);
    setFeedback(
      result.ok ? t.campaignDeactivatedSuccess : result.error
    );
  }

  return (
    <tr className="border-t border-border align-top">
      <td className="px-3 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{campaign.name}</span>
          <span className="text-xs text-muted-foreground">
            {campaign.adAccountName}
          </span>
        </div>
      </td>
      <td className="px-3 py-3">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${OWNERSHIP_STYLES[campaign.ownership]}`}
        >
          {ownershipLabel}
        </span>
      </td>
      <td className="px-3 py-3">
        {campaign.effectiveClientName ?? t.campaignOwnershipNone}
      </td>
      <td className="px-3 py-3">
        <select
          aria-label={t.campaignTableTarget}
          value={targetClientId}
          onChange={(event) => setTargetClientId(event.target.value)}
          disabled={busy !== null}
          className="h-8 w-full max-w-xs rounded-md border border-border bg-background px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
        >
          <option value="">{t.campaignTargetSelectPlaceholder}</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-col items-start gap-2">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleAssign}
              disabled={busy !== null || targetClientId.length === 0}
            >
              {busy === "assign"
                ? campaign.ownership === "assigned"
                  ? t.campaignChangeBusy
                  : t.campaignAssignBusy
                : campaign.ownership === "assigned"
                  ? t.campaignChangeButton
                  : t.campaignAssignButton}
            </Button>
            {campaign.activeAssignment && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleDeactivate}
                disabled={busy !== null}
              >
                {busy === "deactivate"
                  ? t.campaignDeactivateBusy
                  : t.campaignDeactivateButton}
              </Button>
            )}
          </div>
          {feedback && (
            <p className="text-xs text-muted-foreground">{feedback}</p>
          )}
        </div>
      </td>
    </tr>
  );
}