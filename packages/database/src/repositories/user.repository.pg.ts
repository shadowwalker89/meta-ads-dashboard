import { randomUUID } from "node:crypto";
import type { PostgresDatabase } from "../client-pg.js";
import type { User, UserRepository } from "@repo/shared";
import { timestampColumn } from "./pg-row-convert.js";

interface UserRow {
  id: string;
  role: string;
  full_name: string;
  email: string;
  client_id: string | null;
  auth_id: string | null;
  is_active: boolean;
  created_at: unknown;
}

export function normalizeUserEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toDomain(row: UserRow): User {
  return {
    id: row.id,
    role: row.role as User["role"],
    fullName: row.full_name,
    email: row.email,
    authId: row.auth_id,
    clientId: row.client_id,
    isActive: row.is_active,
    createdAt: timestampColumn(row.created_at, "created_at"),
  };
}

export class PgUserRepository implements UserRepository {
  constructor(private readonly db: PostgresDatabase) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.db.queryOne<UserRow>(
      "SELECT * FROM users WHERE id = $1",
      [id]
    );
    return row ? toDomain(row) : null;
  }

  async listAll(): Promise<User[]> {
    const rows = await this.db.query<UserRow>(
      "SELECT * FROM users ORDER BY created_at DESC, id DESC"
    );
    return rows.map(toDomain);
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.db.queryOne<UserRow>(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );
    return row ? toDomain(row) : null;
  }

  async findByNormalizedEmail(email: string): Promise<User | null> {
    const row = await this.db.queryOne<UserRow>(
      "SELECT * FROM users WHERE lower(trim(email)) = $1",
      [normalizeUserEmail(email)]
    );
    return row ? toDomain(row) : null;
  }

  async findByAuthId(authId: string): Promise<User | null> {
    const row = await this.db.queryOne<UserRow>(
      "SELECT * FROM users WHERE auth_id = $1",
      [authId]
    );
    return row ? toDomain(row) : null;
  }

  async setAuthId(id: string, authId: string | null): Promise<boolean> {
    const result = await this.db.query<{ id: string }>(
      "UPDATE users SET auth_id = $1 WHERE id = $2 RETURNING id",
      [authId, id]
    );
    return result.length === 1;
  }

  async create(user: Omit<User, "id" | "createdAt">): Promise<User> {
    const id = randomUUID();
    const createdAt = new Date();
    await this.db.execute(
      `INSERT INTO users (id, role, full_name, email, auth_id, client_id, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        user.role,
        user.fullName,
        user.email,
        user.authId ?? null,
        user.clientId,
        user.isActive ?? true,
        createdAt,
      ]
    );
    return { id, ...user, createdAt };
  }

  async update(
    id: string,
    changes: Partial<Omit<User, "id" | "createdAt">>
  ): Promise<User> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`User not found: ${id}`);
    }
    const merged: User = { ...existing, ...changes };
    await this.db.execute(
      `UPDATE users
       SET role = $1, full_name = $2, email = $3, client_id = $4, is_active = $5
       WHERE id = $6`,
      [merged.role, merged.fullName, merged.email, merged.clientId, merged.isActive, id]
    );
    return merged;
  }
}
