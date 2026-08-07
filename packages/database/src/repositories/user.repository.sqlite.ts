import type { Database } from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { User, UserRepository } from "@repo/shared";

interface UserRow {
  id: string;
  role: string;
  full_name: string;
  email: string;
  created_at: string;
}

function toDomain(row: UserRow): User {
  return {
    id: row.id,
    role: row.role as User["role"],
    fullName: row.full_name,
    email: row.email,
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

  async findByEmail(email: string): Promise<User | null> {
    const row = this.db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(email) as UserRow | undefined;
    return row ? toDomain(row) : null;
  }

  async create(user: Omit<User, "id" | "createdAt">): Promise<User> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        "INSERT INTO users (id, role, full_name, email, created_at) VALUES (?, ?, ?, ?, ?)"
      )
      .run(id, user.role, user.fullName, user.email, createdAt);
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
      .prepare("UPDATE users SET role = ?, full_name = ?, email = ? WHERE id = ?")
      .run(merged.role, merged.fullName, merged.email, id);
    return merged;
  }
}
