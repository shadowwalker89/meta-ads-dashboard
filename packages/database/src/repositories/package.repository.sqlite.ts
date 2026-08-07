import type { Database } from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { Package, PackageRepository } from "@repo/shared";

interface PackageRow {
  id: string;
  name: string;
  description: string;
  metric_thresholds: string;
  created_at: string;
}

function toDomain(row: PackageRow): Package {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    metricThresholds: JSON.parse(row.metric_thresholds),
    createdAt: new Date(row.created_at),
  };
}

export class SqlitePackageRepository implements PackageRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Package | null> {
    const row = this.db.prepare("SELECT * FROM packages WHERE id = ?").get(id) as
      | PackageRow
      | undefined;
    return row ? toDomain(row) : null;
  }

  async listAll(): Promise<Package[]> {
    const rows = this.db
      .prepare("SELECT * FROM packages ORDER BY created_at")
      .all() as PackageRow[];
    return rows.map(toDomain);
  }

  async create(pkg: Omit<Package, "id" | "createdAt">): Promise<Package> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO packages (id, name, description, metric_thresholds, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(id, pkg.name, pkg.description, JSON.stringify(pkg.metricThresholds), createdAt);
    return { id, ...pkg, createdAt: new Date(createdAt) };
  }

  async update(
    id: string,
    changes: Partial<Omit<Package, "id" | "createdAt">>
  ): Promise<Package> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Package not found: ${id}`);
    }
    const merged: Package = { ...existing, ...changes };
    this.db
      .prepare(
        "UPDATE packages SET name = ?, description = ?, metric_thresholds = ? WHERE id = ?"
      )
      .run(merged.name, merged.description, JSON.stringify(merged.metricThresholds), id);
    return merged;
  }
}
