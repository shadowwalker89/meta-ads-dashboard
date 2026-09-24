import type { Database } from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { User, UserRepository } from "@repo/shared";

interface UserRow {
  id: string;
  role: string;
  full_name: string;
  email: string;
  client_id: string | null;
  auth_id: string | null;
  is_active: number;
  created_at: string;
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
    isActive: row.is_active === 1,
    createdAt: new Date(row.created_at),
  };
}

export class SqliteUserRepository implements UserRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<User | null> {
    const row = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
      | UserRow
      | undefined;
    return row ? toDomain(row) : null;
  }

  async listAll(): Promise<User[]> {
    const rows = this.db
      .prepare("SELECT * FROM users ORDER BY created_at DESC, id DESC")
      .all() as UserRow[];
    return rows.map(toDomain);
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = this.db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(email) as UserRow | undefined;
    return row ? toDomain(row) : null;
  }

  async findByNormalizedEmail(email: string): Promise<User | null> {
    const row = this.db
      .prepare("SELECT * FROM users WHERE lower(trim(email)) = ?")
      .get(normalizeUserEmail(email)) as UserRow | undefined;
    return row ? toDomain(row) : null;
  }

  async findByAuthId(authId: string): Promise<User | null> {
    const row = this.db
      .prepare("SELECT * FROM users WHERE auth_id = ?")
      .get(authId) as UserRow | undefined;
    return row ? toDomain(row) : null;
  }

  async setAuthId(id: string, authId: string | null): Promise<boolean> {
    const result = this.db
      .prepare("UPDATE users SET auth_id = ? WHERE id = ?")
      .run(authId, id);
    return result.changes === 1;
  }

  async create(user: Omit<User, "id" | "createdAt">): Promise<User> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        "INSERT INTO users (id, role, full_name, email, auth_id, client_id, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        id,
        user.role,
        user.fullName,
        user.email,
        user.authId ?? null,
        user.clientId,
        user.isActive ?? true ? 1 : 0,
        createdAt
      );
    return { id, ...user, createdAt: new Date(createdAt) };
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
    this.db
      .prepare(
        "UPDATE users SET role = ?, full_name = ?, email = ?, client_id = ?, is_active = ? WHERE id = ?"
      )
      .run(merged.role, merged.fullName, merged.email, merged.clientId, merged.isActive ? 1 : 0, id);
    return merged;
  }
}
