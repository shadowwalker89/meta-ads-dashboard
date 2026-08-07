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
  create(campaign: Omit<Campaign, "id" | "createdAt">): Promise<Campaign>;
  update(
    id: string,
    changes: Partial<Omit<Campaign, "id" | "createdAt">>
  ): Promise<Campaign>;
}
