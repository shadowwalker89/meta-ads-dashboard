import type { Campaign } from "../entities";

export interface CampaignRepository {
  findById(id: string): Promise<Campaign | null>;
  findByAdAccount(adAccountId: string): Promise<Campaign[]>;
  create(campaign: Omit<Campaign, "id" | "createdAt">): Promise<Campaign>;
  update(
    id: string,
    changes: Partial<Omit<Campaign, "id" | "createdAt">>
  ): Promise<Campaign>;
}
