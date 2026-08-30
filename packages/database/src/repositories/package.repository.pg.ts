import { randomUUID } from "node:crypto";
import type { PostgresDatabase } from "../client-pg.js";
import type { Package, PackageRepository } from "@repo/shared";
import {
  isValidPackageSettings,
  sanitizePackageDefaultKpis,
  sanitizePackageFeatures,
  sanitizePackagePricingDefaults,
} from "@repo/shared";
import { bigIntColumn, jsonbColumn, jsonbParam, timestampColumn } from "./pg-row-convert.js";

interface PackageRow {
  id: string;
  name: string;
  description: string;
  code: string | null;
  collection_frequency: unknown;
  max_ad_accounts: unknown;
  max_campaigns: unknown;
  retention_days: unknown;
  default_visible_kpis: unknown;
  features: unknown;
  pricing_defaults: unknown;
  metric_thresholds: unknown;
  created_at: unknown;
}

function toDomain(row: PackageRow): Package {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    code: row.code,
    collectionFrequency: bigIntColumn(row.collection_frequency, "collection_frequency"),
    maxAdAccounts: row.max_ad_accounts === null ? null : bigIntColumn(row.max_ad_accounts, "max_ad_accounts"),
    maxCampaigns: row.max_campaigns === null ? null : bigIntColumn(row.max_campaigns, "max_campaigns"),
    retentionDays: row.retention_days === null ? null : bigIntColumn(row.retention_days, "retention_days"),
    defaultVisibleKpis: sanitizePackageDefaultKpis(jsonbColumn(row.default_visible_kpis)),
    features: sanitizePackageFeatures(jsonbColumn(row.features)),
    pricingDefaults: sanitizePackagePricingDefaults(jsonbColumn(row.pricing_defaults)),
    metricThresholds: (jsonbColumn<Record<string, unknown>>(row.metric_thresholds)) ?? {},
    createdAt: timestampColumn(row.created_at, "created_at"),
  };
}

export class PgPackageRepository implements PackageRepository {
  constructor(private readonly db: PostgresDatabase) {}

  async findById(id: string): Promise<Package | null> {
    const row = await this.db.queryOne<PackageRow>(
      "SELECT * FROM packages WHERE id = $1",
      [id]
    );
    return row ? toDomain(row) : null;
  }

  async findByCode(code: string): Promise<Package | null> {
    const row = await this.db.queryOne<PackageRow>(
      "SELECT * FROM packages WHERE code = $1 LIMIT 1",
      [code]
    );
    return row ? toDomain(row) : null;
  }

  async listAll(): Promise<Package[]> {
    const rows = await this.db.query<PackageRow>(
      "SELECT * FROM packages ORDER BY created_at"
    );
    return rows.map(toDomain);
  }

  async create(pkg: Omit<Package, "id" | "createdAt">): Promise<Package> {
    if (!isValidPackageSettings(pkg)) {
      throw new Error(
        "Package requires a non-empty code and a positive collection frequency"
      );
    }
    const id = randomUUID();
    const createdAt = new Date();
    await this.db.execute(
      `INSERT INTO packages
         (id, name, description, code, collection_frequency, max_ad_accounts,
          max_campaigns, retention_days, default_visible_kpis, features,
          pricing_defaults, metric_thresholds, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        id,
        pkg.name,
        pkg.description,
        pkg.code,
        pkg.collectionFrequency,
        pkg.maxAdAccounts,
        pkg.maxCampaigns,
        pkg.retentionDays,
        jsonbParam(sanitizePackageDefaultKpis(pkg.defaultVisibleKpis)),
        jsonbParam(sanitizePackageFeatures(pkg.features)),
        jsonbParam(sanitizePackagePricingDefaults(pkg.pricingDefaults)),
        jsonbParam(pkg.metricThresholds ?? {}),
        createdAt,
      ]
    );
    return { id, ...pkg, createdAt };
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
    await this.db.execute(
      `UPDATE packages
       SET name = $1, description = $2, code = $3, collection_frequency = $4,
           max_ad_accounts = $5, max_campaigns = $6, retention_days = $7,
           default_visible_kpis = $8, features = $9, pricing_defaults = $10,
           metric_thresholds = $11
       WHERE id = $12`,
      [
        merged.name,
        merged.description,
        merged.code,
        merged.collectionFrequency,
        merged.maxAdAccounts,
        merged.maxCampaigns,
        merged.retentionDays,
        jsonbParam(sanitizePackageDefaultKpis(merged.defaultVisibleKpis)),
        jsonbParam(sanitizePackageFeatures(merged.features)),
        jsonbParam(sanitizePackagePricingDefaults(merged.pricingDefaults)),
        jsonbParam(merged.metricThresholds ?? {}),
        id,
      ]
    );
    return merged;
  }
}
