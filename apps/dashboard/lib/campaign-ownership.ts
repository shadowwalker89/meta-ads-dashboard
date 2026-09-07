import type { User } from "@repo/shared";
import { getDatabase, getRepositories } from "@/lib/db";
import { requireClientAccess } from "@/lib/access";

type Db = ReturnType<typeof getDatabase>;

/**
 * Server-only. Resolves the effective client owning a given campaign.
 *
 * Rules:
 * 1. If an active CampaignAssignment exists for the campaign, use its clientId.
 * 2. Otherwise, use the AdAccount's clientId (fallback).
 * 3. Never infer from name/label/objective/status.
 *
 * The caller must already have access to the resolved clientId before using it
 * (or pass the user to verify access).
 *
 * Returns the clientId, or null if the campaign does not exist or has no
 * AdAccount and no assignment.
 */
export async function getEffectiveClientIdForCampaign(
  campaignId: string,
  db: Db = getDatabase()
): Promise<string | null> {
  const { campaignAssignmentRepository, campaignRepository, adAccountRepository } =
    getRepositories(db);

  const assignment = await campaignAssignmentRepository.findActiveByCampaign(campaignId);
  if (assignment) {
    return assignment.clientId;
  }

  const campaign = await campaignRepository.findById(campaignId);
  if (!campaign) {
    return null;
  }

  const adAccount = await adAccountRepository.findById(campaign.adAccountId);
  if (!adAccount) {
    return null;
  }

  return adAccount.clientId;
}

/**
 * Resolves the effective client for a campaign and verifies the user has access
 * to that client. Throws AccessError if the user cannot access the resolved client.
 * Returns the clientId on success.
 */
export async function resolveAndVerifyCampaignClient(
  user: Pick<User, "role" | "id" | "clientId">,
  campaignId: string,
  db: Db = getDatabase()
): Promise<string> {
  const clientId = await getEffectiveClientIdForCampaign(campaignId, db);
  if (!clientId) {
    throw new Error(`Campaign ${campaignId} has no client ownership`);
  }
  await requireClientAccess(user, clientId, db);
  return clientId;
}