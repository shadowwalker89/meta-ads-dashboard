// This file exists to satisfy the import in provider.ts; the PgCampaignRepository
// is not yet implemented. The placeholder implementation throws.
import type { PostgresDatabase } from "../client-pg.js";
import type { Campaign, CampaignRepository } from "@repo/shared";

export class PgCampaignRepository implements CampaignRepository {
  constructor(private readonly db: PostgresDatabase) {}

  async findById(id: string): Promise<Campaign | null> {
    throw new Error("PgCampaignRepository not implemented");
  }

  async findByAdAccount(adAccountId: string): Promise<Campaign[]> {
    throw new Error("PgCampaignRepository not implemented");
  }

  async findByAdAccountAndLabel(adAccountId: string, scrapedLabel: string): Promise<Campaign | null> {
    throw new Error("PgCampaignRepository not implemented");
  }

  async findByIds(ids: string[]): Promise<Campaign[]> {
    throw new Error("PgCampaignRepository not implemented");
  }

  async findByClient(clientId: string): Promise<Campaign[]> {
    throw new Error("PgCampaignRepository not implemented");
  }

  async create(campaign: Omit<Campaign, "id" | "createdAt">): Promise<Campaign> {
    throw new Error("PgCampaignRepository not implemented");
  }

  async update(id: string, changes: Partial<Omit<Campaign, "id" | "createdAt">>): Promise<Campaign> {
    throw new Error("PgCampaignRepository not implemented");
  }
}