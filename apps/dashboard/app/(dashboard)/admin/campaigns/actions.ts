"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/access";
import {
  runAssignCampaignToClient,
  runDeactivateCampaignAssignment,
  type ActionResult,
  type AssignCampaignResult,
  type DeactivateCampaignResult,
} from "@/lib/campaign-admin";

const CAMPAIGNS_PAGE = "/admin/campaigns";

/**
 * Assigns (or reassigns) a campaign's explicit client ownership.
 * Authorization is enforced inside the runner: the acting user must be an
 * admin/super_admin AND be able to reach both the campaign's current
 * effective client and the target client. The browser can never choose a
 * client the actor does not manage.
 */
export async function assignCampaign(
  campaignId: string,
  targetClientId: string
): Promise<ActionResult<AssignCampaignResult>> {
  const user = await requireUser().catch(() => null);
  if (!user) {
    return { ok: false, error: "ابتدا وارد شوید." };
  }
  const outcome = await runAssignCampaignToClient(user, campaignId, targetClientId);
  if (outcome.ok) {
    revalidatePath(CAMPAIGNS_PAGE);
  }
  return outcome;
}

/**
 * Deactivates a campaign's active explicit assignment, restoring natural
 * (AdAccount) ownership. The assignment row is retained with
 * is_active = false — history is never deleted.
 */
export async function deactivateCampaignAssignment(
  campaignId: string
): Promise<ActionResult<DeactivateCampaignResult>> {
  const user = await requireUser().catch(() => null);
  if (!user) {
    return { ok: false, error: "ابتدا وارد شوید." };
  }
  const outcome = await runDeactivateCampaignAssignment(user, campaignId);
  if (outcome.ok) {
    revalidatePath(CAMPAIGNS_PAGE);
  }
  return outcome;
}