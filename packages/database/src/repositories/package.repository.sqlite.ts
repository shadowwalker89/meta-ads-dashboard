import type { Database } from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { Package, PackageRepository } from "@repo/shared";
import {
  isValidPackageSettings,
  sanitizePackageDefaultKpis,
  sanitizePackageFeatures,
  sanitizePackagePricingDefaults,
} from "@repo/shared";

interface PackageRow {
  id: string;
  name: string;
  description: string;
  code: string | null;
  collection_frequency: number;
  max_ad_accounts: number | null;
  max_campaigns: number | null;
  retention_days: number | null;
  default_visible_kpis: string;
  features: string;
  pricing_defaults: string;
  metric_thresholds: string;
  created_at: string;
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function toDomain(row: PackageRow): Package {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    code: row.code,
    collectionFrequency: row.collection_frequency,
    maxAdAccounts: row.max_ad_accounts,
    maxCampaigns: row.max_campaigns,
    retentionDays: row.retention_days,
    defaultVisibleKpis: sanitizePackageDefaultKpis(parseJson(row.default_visible_kpis)),
    features: sanitizePackageFeatures(parseJson(row.features)),
    pricingDefaults: sanitizePackagePricingDefaults(parseJson(row.pricing_defaults)),
    metricThresholds: (parseJson(row.metric_thresholds) as Record<string, unknown>) ?? {},
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

  async findByCode(code: string): Promise<Package | null> {
    const row = this.db
      .prepare("SELECT * FROM packages WHERE code = ? LIMIT 1")
      .get(code) as PackageRow | undefined;
    return row ? toDomain(row) : null;
  }

  async listAll(): Promise<Package[]> {
    const rows = this.db
      .prepare("SELECT * FROM packages ORDER BY created_at")
      .all() as PackageRow[];
    return rows.map(toDomain);
  }

  async create(pkg: Omit<Package, "id" | "createdAt">): Promise<Package> {
    if (!isValidPackageSettings(pkg)) {
      throw new Error(
        "Package requires a non-empty code and a positive collection frequency"
      );
    }

    const id = randomUUID();
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO packages
           (id, name, description, code, collection_frequency, max_ad_accounts,
            max_campaigns, retention_days, default_visible_kpis, features,
            pricing_defaults, metric_thresholds, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        pkg.name,
        pkg.description,
        pkg.code,
        pkg.collectionFrequency,
        pkg.maxAdAccounts,
        pkg.maxCampaigns,
        pkg.retentionDays,
        JSON.stringify(sanitizePackageDefaultKpis(pkg.defaultVisibleKpis)),
        JSON.stringify(sanitizePackageFeatures(pkg.features)),
        JSON.stringify(sanitizePackagePricingDefaults(pkg.pricingDefaults)),
        JSON.stringify(pkg.metricThresholds ?? {}),
        createdAt
      );
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
    if (!isValidPackageSettings(merged)) {
      throw new Error(
        "Package requires a non-empty code and a positive collection frequency"
      );
    }

    this.db
      .prepare(
        `UPDATE packages
         SET name = ?, description = ?, code = ?, collection_frequency = ?,
             max_ad_accounts = ?, max_campaigns = ?, retention_days = ?,
             default_visible_kpis = ?, features = ?, pricing_defaults = ?,
             metric_thresholds = ?
         WHERE id = ?`
      )
      .run(
        merged.name,
        merged.description,
        merged.code,
        merged.collectionFrequency,
        merged.maxAdAccounts,
        merged.maxCampaigns,
        merged.retentionDays,
        JSON.stringify(sanitizePackageDefaultKpis(merged.defaultVisibleKpis)),
        JSON.stringify(sanitizePackageFeatures(merged.features)),
        JSON.stringify(sanitizePackagePricingDefaults(merged.pricingDefaults)),
        JSON.stringify(merged.metricThresholds ?? {}),
        id
      );
    return merged;
  }
}