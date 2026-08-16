import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { runMigrations } from "../src/migrations/migrate.js";
import {
  SqlitePackageRepository,
  SqliteClientRepository,
  SqliteAdAccountRepository,
  SqliteCampaignRepository,
} from "../src/repositories/index.js";

function createTestDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

test("findByAdAccountAndLabel finds an existing campaign and returns null for an unknown label", async () => {
  const db = createTestDb();

  const packages = new SqlitePackageRepository(db);
  const clients = new SqliteClientRepository(db);
  const adAccounts = new SqliteAdAccountRepository(db);
  const campaigns = new SqliteCampaignRepository(db);

  const pkg = await packages.create({
    name: "Gold",
    description: "Gold plan",
    code: "gold",
    collectionFrequency: 12,
    maxAdAccounts: null,
    maxCampaigns: null,
    retentionDays: null,
    defaultVisibleKpis: [],
    features: { charts: false, dataExport: false, advancedReporting: false },
    pricingDefaults: {},
    metricThresholds: {},
  });

  const client = await clients.create({
    name: "Test Client",
    businessType: "E-commerce",
    contactEmail: "client@example.com",
    packageId: pkg.id,
    isActive: true,
  });

  const adAccount = await adAccounts.create({
    clientId: client.id,
    name: "Main Ad Account",
    status: "connected",
    source: "playwright",
    metaAdAccountId: null,
  });

  const campaignOne = await campaigns.create({
    adAccountId: adAccount.id,
    name: "Campaign One",
    objective: "unknown",
    status: "unknown",
    scrapedLabel: "Campaign One",
    metaCampaignId: null,
  });

  const found = await campaigns.findByAdAccountAndLabel(adAccount.id, "Campaign One");
  assert.equal(found?.id, campaignOne.id);

  const notFound = await campaigns.findByAdAccountAndLabel(adAccount.id, "Campaign Two");
  assert.equal(notFound, null);

  db.close();
});
