import { randomUUID } from "node:crypto";
import type { PostgresDatabase } from "../client-pg.js";
import type { Campaign, CampaignRepository } from "@repo/shared";
import { timestampColumn } from "./pg-row-convert.js";

interface CampaignRow {
  id: string;
  ad_account_id: string;
  name: string;
  objective: string;
  status: string;
  scraped_label: string | null;
  meta_campaign_id: string | null;
  created_at: unknown;
}

function toDomain(row: CampaignRow): Campaign {
  return {
    id: row.id,
    adAccountId: row.ad_account_id,
    name: row.name,
    objective: row.objective,
    status: row.status,
    scrapedLabel: row.scraped_label,
    metaCampaignId: row.meta_campaign_id,
    createdAt: timestampColumn(row.created_at, "created_at"),
  };
}

export class PgCampaignRepository implements CampaignRepository {
  constructor(private readonly db: PostgresDatabase) {}

  async findById(id: string): Promise<Campaign | null> {
    const row = await this.db.queryOne<CampaignRow>(
      "SELECT * FROM campaigns WHERE id = $1",
      [id]
    );
    return row ? toDomain(row) : null;
  }

  async findByAdAccount(adAccountId: string): Promise<Campaign[]> {
    const rows = await this.db.query<CampaignRow>(
      "SELECT * FROM campaigns WHERE ad_account_id = $1",
      [adAccountId]
    );
    return rows.map(toDomain);
  }

  async findByAdAccountAndLabel(
    adAccountId: string,
    scrapedLabel: string
  ): Promise<Campaign | null> {
    const row = await this.db.queryOne<CampaignRow>(
      "SELECT * FROM campaigns WHERE ad_account_id = $1 AND scraped_label = $2",
      [adAccountId, scrapedLabel]
    );
    return row ? toDomain(row) : null;
  }

  async create(campaign: Omit<Campaign, "id" | "createdAt">): Promise<Campaign> {
    const id = randomUUID();
    const createdAt = new Date();
    await this.db.execute(
      `INSERT INTO campaigns
         (id, ad_account_id, name, objective, status, scraped_label, meta_campaign_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        campaign.adAccountId,
        campaign.name,
        campaign.objective,
        campaign.status,
        campaign.scrapedLabel,
        campaign.metaCampaignId,
        createdAt,
      ]
    );
    return { id, ...campaign, createdAt };
  }

  async update(
    id: string,
    changes: Partial<Omit<Campaign, "id" | "createdAt">>
  ): Promise<Campaign> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Campaign not found: ${id}`);
    }
    const merged: Campaign = { ...existing, ...changes };
    await this.db.execute(
      `UPDATE campaigns
       SET name = $1, objective = $2, status = $3, scraped_label = $4, meta_campaign_id = $5
       WHERE id = $6`,
      [
        merged.name,
        merged.objective,
        merged.status,
        merged.scrapedLabel,
        merged.metaCampaignId,
        id,
      ]
    );
    return merged;
  }
}
