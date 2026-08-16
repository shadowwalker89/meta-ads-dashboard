import { openDatabase } from "./client.js";
import { runMigrations } from "./migrations/migrate.js";
import {
  SqliteUserRepository,
  SqliteClientRepository,
  SqlitePackageRepository,
} from "./repositories/index.js";
import type {
  DashboardKpiKey,
  PackageFeatures,
  PackagePricingDefaults,
} from "@repo/shared";
import { DEFAULT_VISIBLE_KPIS } from "@repo/shared";

interface TierSettings {
  code: string;
  description: string;
  collectionFrequency: number;
  maxAdAccounts: number | null;
  maxCampaigns: number | null;
  retentionDays: number | null;
  defaultVisibleKpis: DashboardKpiKey[];
  features: PackageFeatures;
  pricingDefaults: PackagePricingDefaults;
}

/**
 * Baseline tier data. These are DB rows, not business logic — tiers and
 * their settings are editable package data and nothing in TypeScript
 * branches on a code. Frequencies follow the planned Bronze 1 / Silver 4
 * / Gold 12 collections-per-day; limits and features are conservative
 * starting points to be finalized with the project owner.
 */
const TIER_SETTINGS: Record<string, TierSettings> = {
  Bronze: {
    code: "bronze",
    description: "برنز",
    collectionFrequency: 1,
    maxAdAccounts: null,
    maxCampaigns: null,
    retentionDays: 30,
    defaultVisibleKpis: [...DEFAULT_VISIBLE_KPIS],
    features: { charts: false, dataExport: false, advancedReporting: false },
    pricingDefaults: {},
  },
  Silver: {
    code: "silver",
    description: "نقره‌ای",
    collectionFrequency: 4,
    maxAdAccounts: null,
    maxCampaigns: null,
    retentionDays: 90,
    defaultVisibleKpis: [...DEFAULT_VISIBLE_KPIS],
    features: { charts: true, dataExport: true, advancedReporting: false },
    pricingDefaults: {},
  },
  Gold: {
    code: "gold",
    description: "طلایی",
    collectionFrequency: 12,
    maxAdAccounts: null,
    maxCampaigns: null,
    retentionDays: 365,
    defaultVisibleKpis: [...DEFAULT_VISIBLE_KPIS],
    features: { charts: true, dataExport: true, advancedReporting: true },
    pricingDefaults: {},
  },
};

async function seed() {
  const db = openDatabase();
  runMigrations(db);

  const users = new SqliteUserRepository(db);
  const clients = new SqliteClientRepository(db);
  const packages = new SqlitePackageRepository(db);

  console.log("Seeding 3 packages...");
  const createdPackages = [];
  for (const [name, settings] of Object.entries(TIER_SETTINGS)) {
    // A tier is identified by its stable code (findByCode), not by name —
    // legacy DBs can contain duplicate-named rows, and only the row with
    // the tier code should carry the tier settings.
    const existing = await packages.findByCode(settings.code);
    if (existing) {
      const updated = await packages.update(existing.id, settings);
      createdPackages.push(updated);
      continue;
    }
    const pkg = await packages.create({
      name,
      ...settings,
      metricThresholds: {},
    });
    createdPackages.push(pkg);
  }

  console.log("Seeding 1 super admin...");
  if (!(await users.findByEmail("superadmin@example.com"))) {
    await users.create({
      role: "super_admin",
      fullName: "Super Admin",
      email: "superadmin@example.com",
      clientId: null,
    });
  }

  console.log("Seeding 3 admins...");
  for (let i = 1; i <= 3; i++) {
    const email = `admin${i}@example.com`;
    if (!(await users.findByEmail(email))) {
      await users.create({
        role: "admin",
        fullName: `Admin ${i}`,
        email,
        clientId: null,
      });
    }
  }

  console.log("Seeding 10 clients...");
  const existingClients = (await clients.list({ limit: 100 })).items;
  const clientsByName = new Map(existingClients.map((c) => [c.name, c]));
  const createdClients = [];
  for (let i = 1; i <= 10; i++) {
    const name = `Client ${i}`;
    const existing = clientsByName.get(name);
    if (existing) {
      createdClients.push(existing);
      continue;
    }
    const pkg = createdPackages[(i - 1) % createdPackages.length];
    const client = await clients.create({
      name,
      businessType: "General",
      contactEmail: `client${i}@example.com`,
      packageId: pkg.id,
      isActive: true,
    });
    createdClients.push(client);
  }

  console.log("Seeding 1 client-role user...");
  if (!(await users.findByEmail("client1user@example.com"))) {
    await users.create({
      role: "client",
      fullName: "Client 1 User",
      email: "client1user@example.com",
      clientId: createdClients[0].id,
    });
  }

  console.log("Seed complete.");
  db.close();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
