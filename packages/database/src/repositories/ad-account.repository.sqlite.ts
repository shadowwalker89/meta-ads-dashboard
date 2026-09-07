import type { Database } from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { AdAccount, AdAccountRepository } from "@repo/shared";

interface AdAccountRow {
  id: string;
  client_id: string;
  name: string;
  status: string;
  source: string;
  meta_ad_account_id: string | null;
  created_at: string;
}

function toDomain(row: AdAccountRow): AdAccount {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    status: row.status as AdAccount["status"],
    source: row.source as AdAccount["source"],
    metaAdAccountId: row.meta_ad_account_id,
    createdAt: new Date(row.created_at),
  };
}

export class SqliteAdAccountRepository implements AdAccountRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<AdAccount | null> {
    const row = this.db.prepare("SELECT * FROM ad_accounts WHERE id = ?").get(id) as
      | AdAccountRow
      | undefined;
    return row ? toDomain(row) : null;
  }

  async findByClient(clientId: string): Promise<AdAccount[]> {
    const rows = this.db
      .prepare("SELECT * FROM ad_accounts WHERE client_id = ?")
      .all(clientId) as AdAccountRow[];
    return rows.map(toDomain);
  }

  async findByIds(ids: string[]): Promise<AdAccount[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => "?").join(", ");
    const rows = this.db
      .prepare(`SELECT * FROM ad_accounts WHERE id IN (${placeholders})`)
      .all(...ids) as AdAccountRow[];
    return rows.map(toDomain);
  }

  async create(adAccount: Omit<AdAccount, "id" | "createdAt">): Promise<AdAccount> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO ad_accounts (id, client_id, name, status, source, meta_ad_account_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        adAccount.clientId,
        adAccount.name,
        adAccount.status,
        adAccount.source,
        adAccount.metaAdAccountId,
        createdAt
      );
    return { id, ...adAccount, createdAt: new Date(createdAt) };
  }

  async updateStatus(id: string, status: AdAccount["status"]): Promise<AdAccount> {
    this.db.prepare("UPDATE ad_accounts SET status = ? WHERE id = ?").run(status, id);
    const updated = await this.findById(id);
    if (!updated) throw new Error(`AdAccount not found: ${id}`);
    return updated;
  }

  async updateSource(
    id: string,
    source: AdAccount["source"],
    metaAdAccountId: string | null
  ): Promise<AdAccount> {
    this.db
      .prepare("UPDATE ad_accounts SET source = ?, meta_ad_account_id = ? WHERE id = ?")
      .run(source, metaAdAccountId, id);
    const updated = await this.findById(id);
    if (!updated) throw new Error(`AdAccount not found: ${id}`);
    return updated;
  }
}
