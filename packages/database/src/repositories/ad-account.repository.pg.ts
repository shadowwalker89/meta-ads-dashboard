import { randomUUID } from "node:crypto";
import type { PostgresDatabase } from "../client-pg.js";
import type { AdAccount, AdAccountRepository } from "@repo/shared";
import { timestampColumn } from "./pg-row-convert.js";

interface AdAccountRow {
  id: string;
  client_id: string;
  name: string;
  status: string;
  source: string;
  meta_ad_account_id: string | null;
  created_at: unknown;
}

function toDomain(row: AdAccountRow): AdAccount {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    status: row.status as AdAccount["status"],
    source: row.source as AdAccount["source"],
    metaAdAccountId: row.meta_ad_account_id,
    createdAt: timestampColumn(row.created_at, "created_at"),
  };
}

export class PgAdAccountRepository implements AdAccountRepository {
  constructor(private readonly db: PostgresDatabase) {}

  async findById(id: string): Promise<AdAccount | null> {
    const row = await this.db.queryOne<AdAccountRow>(
      "SELECT * FROM ad_accounts WHERE id = $1",
      [id]
    );
    return row ? toDomain(row) : null;
  }

  async findByClient(clientId: string): Promise<AdAccount[]> {
    const rows = await this.db.query<AdAccountRow>(
      "SELECT * FROM ad_accounts WHERE client_id = $1",
      [clientId]
    );
    return rows.map(toDomain);
  }

  async create(adAccount: Omit<AdAccount, "id" | "createdAt">): Promise<AdAccount> {
    const id = randomUUID();
    const createdAt = new Date();
    await this.db.execute(
      `INSERT INTO ad_accounts (id, client_id, name, status, source, meta_ad_account_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        adAccount.clientId,
        adAccount.name,
        adAccount.status,
        adAccount.source,
        adAccount.metaAdAccountId,
        createdAt,
      ]
    );
    return { id, ...adAccount, createdAt };
  }

  async updateStatus(id: string, status: AdAccount["status"]): Promise<AdAccount> {
    await this.db.execute(
      "UPDATE ad_accounts SET status = $1 WHERE id = $2",
      [status, id]
    );
    const updated = await this.findById(id);
    if (!updated) throw new Error(`AdAccount not found: ${id}`);
    return updated;
  }

  async updateSource(
    id: string,
    source: AdAccount["source"],
    metaAdAccountId: string | null
  ): Promise<AdAccount> {
    await this.db.execute(
      "UPDATE ad_accounts SET source = $1, meta_ad_account_id = $2 WHERE id = $3",
      [source, metaAdAccountId, id]
    );
    const updated = await this.findById(id);
    if (!updated) throw new Error(`AdAccount not found: ${id}`);
    return updated;
  }
}