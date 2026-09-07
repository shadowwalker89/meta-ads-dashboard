import type { Campaign } from "../entities";

export interface CampaignRepository {
  findById(id: string): Promise<Campaign | null>;
  findByAdAccount(adAccountId: string): Promise<Campaign[]>;
  /**
   * Added in Sprint 5 for Collector Campaign Discovery: given a scraped
   * campaign name for a specific AdAccount, find the matching Campaign
   * row (if one was already discovered in a previous collection run).
   * Returns null when no match exists yet — the caller (Collector)
   * is responsible for creating one via `create()` in that case.
   */
  findByAdAccountAndLabel(
    adAccountId: string,
    scrapedLabel: string
  ): Promise<Campaign | null>;
  /**
   * Find multiple campaigns by their IDs.
   */
  findByIds(ids: string[]): Promise<Campaign[]>;
  /**
   * Find all campaigns owned by a client, considering both AdAccount ownership
   * and explicit CampaignAssignment. A campaign is owned by the client if:
   *   - it has an active assignment to this client, OR
   *   - it has no active assignment and its ad_account's client_id matches.
   */
  findByClient(clientId: string): Promise<Campaign[]>;
  create(campaign: Omit<Campaign, "id" | "createdAt">): Promise<Campaign>;
  update(
    id: string,
    changes: Partial<Omit<Campaign, "id" | "createdAt">>
  ): Promise<Campaign>;
}
