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
  created_at: unknown;
}

function toDomain(row: UserRow): User {
  return {
    id: row.id,
    role: row.role as User["role"],
    fullName: row.full_name,
    email: row.email,
    clientId: row.client_id,
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

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.db.queryOne<UserRow>(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );
    return row ? toDomain(row) : null;
  }

  async create(user: Omit<User, "id" | "createdAt">): Promise<User> {
    const id = randomUUID();
    const createdAt = new Date();
    await this.db.execute(
      `INSERT INTO users (id, role, full_name, email, client_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, user.role, user.fullName, user.email, user.clientId, createdAt]
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
       SET role = $1, full_name = $2, email = $3, client_id = $4
       WHERE id = $5`,
      [merged.role, merged.fullName, merged.email, merged.clientId, id]
    );
    return merged;
  }
}
