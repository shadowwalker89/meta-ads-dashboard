import type { Database } from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { Campaign, CampaignRepository } from "@repo/shared";

interface CampaignRow {
  id: string;
  ad_account_id: string;
  name: string;
  objective: string;
  status: string;
  scraped_label: string | null;
  meta_campaign_id: string | null;
  created_at: string;
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
    createdAt: new Date(row.created_at),
  };
}

export class SqliteCampaignRepository implements CampaignRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Campaign | null> {
    const row = this.db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id) as
      | CampaignRow
      | undefined;
    return row ? toDomain(row) : null;
  }

  async findByAdAccount(adAccountId: string): Promise<Campaign[]> {
    const rows = this.db
      .prepare("SELECT * FROM campaigns WHERE ad_account_id = ?")
      .all(adAccountId) as CampaignRow[];
    return rows.map(toDomain);
  }

  async findByAdAccountAndLabel(
    adAccountId: string,
    scrapedLabel: string
  ): Promise<Campaign | null> {
    const row = this.db
      .prepare(
        "SELECT * FROM campaigns WHERE ad_account_id = ? AND scraped_label = ?"
      )
      .get(adAccountId, scrapedLabel) as CampaignRow | undefined;
    return row ? toDomain(row) : null;
  }

  async findByIds(ids: string[]): Promise<Campaign[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => "?").join(", ");
    const rows = this.db
      .prepare(`SELECT * FROM campaigns WHERE id IN (${placeholders})`)
      .all(...ids) as CampaignRow[];
    return rows.map(toDomain);
  }

  async findByClient(clientId: string): Promise<Campaign[]> {
    // Campaigns visible to this client:
    // 1. Owned via AdAccount, unless there is an active assignment to a different client.
    // 2. Explicitly assigned to this client (active).
    const rows = this.db
      .prepare(
        `SELECT c.* FROM campaigns c
         JOIN ad_accounts a ON c.ad_account_id = a.id
         LEFT JOIN campaign_assignments ca ON c.id = ca.campaign_id AND ca.is_active = 1
         WHERE a.client_id = ? AND (ca.client_id IS NULL OR ca.client_id = ?)
         UNION
         SELECT c.* FROM campaigns c
         JOIN campaign_assignments ca ON c.id = ca.campaign_id
         WHERE ca.client_id = ? AND ca.is_active = 1`
      )
      .all(clientId, clientId, clientId) as CampaignRow[];
    return rows.map(toDomain);
  }

  async create(campaign: Omit<Campaign, "id" | "createdAt">): Promise<Campaign> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO campaigns
           (id, ad_account_id, name, objective, status, scraped_label, meta_campaign_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        campaign.adAccountId,
        campaign.name,
        campaign.objective,
        campaign.status,
        campaign.scrapedLabel,
        campaign.metaCampaignId,
        createdAt
      );
    return { id, ...campaign, createdAt: new Date(createdAt) };
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
    this.db
      .prepare(
        `UPDATE campaigns
         SET name = ?, objective = ?, status = ?, scraped_label = ?, meta_campaign_id = ?
         WHERE id = ?`
      )
      .run(
        merged.name,
        merged.objective,
        merged.status,
        merged.scrapedLabel,
        merged.metaCampaignId,
        id
      );
    return merged;
  }
}
