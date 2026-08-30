import { randomUUID } from "node:crypto";
import type { PostgresDatabase } from "../client-pg.js";
import type {
  Client,
  ClientRepository,
  PageRequest,
  PageResult,
} from "@repo/shared";
import { timestampColumn } from "./pg-row-convert.js";

interface ClientRow {
  id: string;
  name: string;
  business_type: string;
  contact_email: string;
  package_id: string;
  package_assigned_at: unknown;
  is_active: boolean;
  created_at: unknown;
}

function toDomain(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    businessType: row.business_type,
    contactEmail: row.contact_email,
    packageId: row.package_id,
    // Legacy rows written before migration 007 fall back to created_at —
    // the same conservative assumption the SQLite implementation uses.
    packageAssignedAt: row.package_assigned_at
      ? timestampColumn(row.package_assigned_at, "package_assigned_at")
      : timestampColumn(row.created_at, "created_at"),
    isActive: row.is_active,
    createdAt: timestampColumn(row.created_at, "created_at"),
  };
}

export class PgClientRepository implements ClientRepository {
  constructor(private readonly db: PostgresDatabase) {}

  async findById(id: string): Promise<Client | null> {
    const row = await this.db.queryOne<ClientRow>(
      "SELECT * FROM clients WHERE id = $1",
      [id]
    );
    return row ? toDomain(row) : null;
  }

  async findByIds(ids: string[]): Promise<Client[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
    const rows = await this.db.query<ClientRow>(
      `SELECT * FROM clients WHERE id IN (${placeholders})`,
      ids
    );
    return rows.map(toDomain);
  }

  // Opaque offset cursor — same contract as the SQLite implementation.
  async list(page: PageRequest): Promise<PageResult<Client>> {
    const offset = page.cursor ? parseInt(page.cursor, 10) : 0;
    const rows = await this.db.query<ClientRow>(
      "SELECT * FROM clients ORDER BY created_at, id LIMIT $1 OFFSET $2",
      [page.limit, offset]
    );
    const items = rows.map(toDomain);
    const nextCursor =
      items.length === page.limit ? String(offset + page.limit) : null;
    return { items, nextCursor };
  }

  async create(
    client: Omit<Client, "id" | "createdAt" | "packageAssignedAt">
  ): Promise<Client> {
    const id = randomUUID();
    const now = new Date();
    await this.db.execute(
      `INSERT INTO clients
         (id, name, business_type, contact_email, package_id, package_assigned_at, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        client.name,
        client.businessType,
        client.contactEmail,
        client.packageId,
        now,
        client.isActive,
        now,
      ]
    );
    return {
      id,
      ...client,
      packageAssignedAt: now,
      createdAt: now,
    };
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

    // A package change is a REASSIGNMENT: refresh the assignment timestamp.
    // Identical semantics to the SQLite implementation.
    if (
      changes.packageId !== undefined &&
      changes.packageId !== existing.packageId
    ) {
      const pkg = await this.db.queryOne<{ id: string }>(
        "SELECT id FROM packages WHERE id = $1",
        [changes.packageId]
      );
      if (!pkg) {
        throw new Error(`Package not found: ${changes.packageId}`);
      }
      merged.packageAssignedAt = changes.packageAssignedAt ?? new Date();
    }

    await this.db.execute(
      `UPDATE clients
       SET name = $1, business_type = $2, contact_email = $3,
           package_id = $4, package_assigned_at = $5, is_active = $6
       WHERE id = $7`,
      [
        merged.name,
        merged.businessType,
        merged.contactEmail,
        merged.packageId,
        merged.packageAssignedAt,
        merged.isActive,
        id,
      ]
    );
    return merged;
  }

  async deactivate(id: string): Promise<void> {
    await this.db.execute(
      "UPDATE clients SET is_active = false WHERE id = $1",
      [id]
    );
  }
}
