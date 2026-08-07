import type { Database } from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type {
  Client,
  ClientRepository,
  PageRequest,
  PageResult,
} from "@repo/shared";

interface ClientRow {
  id: string;
  name: string;
  business_type: string;
  contact_email: string;
  package_id: string;
  is_active: number;
  created_at: string;
}

function toDomain(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    businessType: row.business_type,
    contactEmail: row.contact_email,
    packageId: row.package_id,
    isActive: row.is_active === 1,
    createdAt: new Date(row.created_at),
  };
}

export class SqliteClientRepository implements ClientRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Client | null> {
    const row = this.db.prepare("SELECT * FROM clients WHERE id = ?").get(id) as
      | ClientRow
      | undefined;
    return row ? toDomain(row) : null;
  }

  async findByIds(ids: string[]): Promise<Client[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => "?").join(", ");
    const rows = this.db
      .prepare(`SELECT * FROM clients WHERE id IN (${placeholders})`)
      .all(...ids) as ClientRow[];
    return rows.map(toDomain);
  }

  // Cursor here is an opaque offset encoded as a string. Callers never
  // need to know that — they only see "give me a cursor, I'll give you
  // the next page" per the storage-agnostic PageRequest/PageResult contract.
  async list(page: PageRequest): Promise<PageResult<Client>> {
    const offset = page.cursor ? parseInt(page.cursor, 10) : 0;
    const rows = this.db
      .prepare("SELECT * FROM clients ORDER BY created_at, id LIMIT ? OFFSET ?")
      .all(page.limit, offset) as ClientRow[];
    const items = rows.map(toDomain);
    const nextCursor = items.length === page.limit ? String(offset + page.limit) : null;
    return { items, nextCursor };
  }

  async create(client: Omit<Client, "id" | "createdAt">): Promise<Client> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO clients (id, name, business_type, contact_email, package_id, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        client.name,
        client.businessType,
        client.contactEmail,
        client.packageId,
        client.isActive ? 1 : 0,
        createdAt
      );
    return { id, ...client, createdAt: new Date(createdAt) };
  }

  async update(
    id: string,
    changes: Partial<Omit<Client, "id" | "createdAt">>
  ): Promise<Client> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Client not found: ${id}`);
    }
    const merged: Client = { ...existing, ...changes };
    this.db
      .prepare(
        `UPDATE clients
         SET name = ?, business_type = ?, contact_email = ?, package_id = ?, is_active = ?
         WHERE id = ?`
      )
      .run(
        merged.name,
        merged.businessType,
        merged.contactEmail,
        merged.packageId,
        merged.isActive ? 1 : 0,
        id
      );
    return merged;
  }

  async deactivate(id: string): Promise<void> {
    this.db.prepare("UPDATE clients SET is_active = 0 WHERE id = ?").run(id);
  }
}
