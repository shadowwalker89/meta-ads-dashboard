import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { runMigrations } from "../src/migrations/migrate.js";
import {
  SqliteUserRepository,
  SqliteClientRepository,
  SqlitePackageRepository,
  SqliteAdAccountRepository,
  SqliteCampaignRepository,
  SqliteInsightSnapshotRepository,
} from "../src/repositories/index.js";

// A fresh in-memory database per test — never touches the real
// data/app.db file, so this is safe to run at any time.
function createTestDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

test("database opens and migrations create all expected tables", () => {
  const db = createTestDb();

  const tables = (
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
      name: string;
    }[]
  ).map((row) => row.name);

  for (const expected of [
    "users",
    "packages",
    "clients",
    "admin_assignments",
    "ad_accounts",
    "campaigns",
    "insight_snapshots",
    "dashboard_preferences",
    "audit_logs",
    "collector_jobs",
    "pricing_rules",
  ]) {
    assert.ok(tables.includes(expected), `missing table: ${expected}`);
  }

  db.close();
});

test("repositories can write and read back seeded-style data", async () => {
  const db = createTestDb();

  const packages = new SqlitePackageRepository(db);
  const users = new SqliteUserRepository(db);
  const clients = new SqliteClientRepository(db);

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
    metricThresholds: { minViews: 1000 },
  });

  const admin = await users.create({
    role: "admin",
    fullName: "Test Admin",
    email: "test-admin@example.com",
    clientId: null,
  });

  const client = await clients.create({
    name: "Test Client",
    businessType: "E-commerce",
    contactEmail: "test-client@example.com",
    packageId: pkg.id,
    isActive: true,
  });

  const clientUser = await users.create({
    role: "client",
    fullName: "Test Client User",
    email: "test-client-user@example.com",
    clientId: client.id,
  });

  const foundPackage = await packages.findById(pkg.id);
  const foundAdmin = await users.findById(admin.id);
  const foundClient = await clients.findById(client.id);
  const foundClientUser = await users.findById(clientUser.id);
  const allPackages = await packages.listAll();

  assert.equal(foundPackage?.name, "Gold");
  assert.deepEqual(foundPackage?.metricThresholds, { minViews: 1000 });
  assert.equal(foundAdmin?.role, "admin");
  assert.equal(foundAdmin?.clientId, null);
  assert.equal(foundClient?.packageId, pkg.id);
  assert.equal(foundClientUser?.clientId, client.id);
  assert.equal(allPackages.length, 1);

  db.close();
});

test("insight snapshots round-trip extended metrics and old rows default to 0", async () => {
  const db = createTestDb();

  const packages = new SqlitePackageRepository(db);
  const clients = new SqliteClientRepository(db);
  const adAccounts = new SqliteAdAccountRepository(db);
  const campaigns = new SqliteCampaignRepository(db);
  const snapshots = new SqliteInsightSnapshotRepository(db);

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
  const campaign = await campaigns.create({
    adAccountId: adAccount.id,
    name: "Campaign One",
    objective: "unknown",
    status: "unknown",
    scrapedLabel: "Campaign One",
    metaCampaignId: null,
  });

  const appended = await snapshots.append({
    campaignId: campaign.id,
    capturedAt: new Date("2026-01-01T00:00:00.000Z"),
    impressions: 10000,
    clicks: 500,
    linkClicks: 400,
    spend: 125,
    ctr: 5,
    cpc: 0.25,
    cpm: 12.5,
    reach: 8000,
    frequency: 1.25,
    clicksAll: 550,
    uniqueClicks: 430,
    uniqueCtr: 4.3,
    landingPageViews: 380,
    outboundClicks: 300,
    outboundCtr: 3,
    leads: 25,
    messagesStarted: 40,
    messagesContacts: 18,
    results: 60,
    costPerResult: 2.08,
    postReactions: 120,
    postComments: 34,
    rawPayload: { test: true },
  });

  const readBack = await snapshots.findLatestForCampaign(campaign.id);
  assert.equal(readBack?.id, appended.id);
  assert.equal(readBack?.frequency, 1.25);
  assert.equal(readBack?.clicksAll, 550);
  assert.equal(readBack?.uniqueClicks, 430);
  assert.equal(readBack?.uniqueCtr, 4.3);
  assert.equal(readBack?.landingPageViews, 380);
  assert.equal(readBack?.outboundClicks, 300);
  assert.equal(readBack?.outboundCtr, 3);
  assert.equal(readBack?.leads, 25);
  assert.equal(readBack?.messagesStarted, 40);
  assert.equal(readBack?.messagesContacts, 18);
  assert.equal(readBack?.results, 60);
  assert.equal(readBack?.costPerResult, 2.08);
  assert.equal(readBack?.postReactions, 120);
  assert.equal(readBack?.postComments, 34);

  // Backward compatibility: a row written with only the original columns
  // must read back with 0 for every new field — never undefined.
  db.prepare(
    `INSERT INTO insight_snapshots
       (id, campaign_id, captured_at, impressions, clicks, link_clicks, spend, ctr, cpc, cpm, reach, raw_payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "legacy-snapshot-id",
    campaign.id,
    "2026-01-02T00:00:00.000Z",
    100,
    10,
    8,
    5,
    10,
    0.5,
    50,
    90,
    null
  );

  const legacy = await snapshots.findLatestForCampaign(campaign.id);
  assert.equal(legacy?.id, "legacy-snapshot-id");
  assert.equal(legacy?.frequency, 0);
  assert.equal(legacy?.clicksAll, 0);
  assert.equal(legacy?.uniqueClicks, 0);
  assert.equal(legacy?.uniqueCtr, 0);
  assert.equal(legacy?.landingPageViews, 0);
  assert.equal(legacy?.outboundClicks, 0);
  assert.equal(legacy?.outboundCtr, 0);
  assert.equal(legacy?.leads, 0);
  assert.equal(legacy?.messagesStarted, 0);
  assert.equal(legacy?.messagesContacts, 0);
  assert.equal(legacy?.results, 0);
  assert.equal(legacy?.costPerResult, 0);
  assert.equal(legacy?.postReactions, 0);
  assert.equal(legacy?.postComments, 0);

  db.close();
});
