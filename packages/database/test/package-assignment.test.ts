import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";
import { runMigrations } from "../src/migrations/migrate.js";
import {
  SqliteAdAccountRepository,
  SqliteCampaignRepository,
  SqliteClientRepository,
  SqliteInsightSnapshotRepository,
  SqlitePackageRepository,
  SqlitePricingRuleRepository,
} from "../src/repositories/index.js";

function createTestDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

function createPackage(db: DatabaseType, code: string, name: string) {
  return new SqlitePackageRepository(db).create({
    name,
    description: `${name} plan`,
    code,
    collectionFrequency: 1,
    maxAdAccounts: null,
    maxCampaigns: null,
    retentionDays: null,
    defaultVisibleKpis: [],
    features: { charts: false, dataExport: false, advancedReporting: false },
    pricingDefaults: {},
    metricThresholds: {},
  });
}

function createClient(db: DatabaseType, packageId: string, name = "Test Client") {
  return new SqliteClientRepository(db).create({
    name,
    businessType: "E-commerce",
    contactEmail: "client@example.com",
    packageId,
    isActive: true,
  });
}

// --- Assignment ---------------------------------------------------------

test("package assignment: create stamps packageAssignedAt and it round-trips", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold");
  const before = Date.now();

  const created = await createClient(db, pkg.id);

  assert.ok(created.packageAssignedAt instanceof Date);
  assert.ok(created.packageAssignedAt.getTime() >= before);

  const found = await new SqliteClientRepository(db).findById(created.id);
  assert.equal(found?.packageId, pkg.id);
  assert.equal(
    found?.packageAssignedAt.getTime(),
    created.packageAssignedAt.getTime()
  );

  const byIds = await new SqliteClientRepository(db).findByIds([created.id]);
  assert.equal(byIds[0]?.packageAssignedAt.getTime(), created.packageAssignedAt.getTime());

  const page = await new SqliteClientRepository(db).list({ limit: 10 });
  assert.equal(page.items[0]?.packageAssignedAt.getTime(), created.packageAssignedAt.getTime());

  db.close();
});

// --- Reassignment -------------------------------------------------------

test("package assignment: reassigning to another package refreshes the timestamp", async () => {
  const db = createTestDb();
  const pkgA = await createPackage(db, "bronze", "Bronze");
  const pkgB = await createPackage(db, "gold", "Gold");

  const clients = new SqliteClientRepository(db);
  const client = await createClient(db, pkgA.id);
  const assignedAt = client.packageAssignedAt.getTime();

  const updated = await clients.update(client.id, { packageId: pkgB.id });

  assert.equal(updated.packageId, pkgB.id);
  assert.ok(
    updated.packageAssignedAt.getTime() >= assignedAt,
    "reassignment must refresh packageAssignedAt"
  );

  const reloaded = await clients.findById(client.id);
  assert.equal(reloaded?.packageId, pkgB.id);
  assert.equal(reloaded?.packageAssignedAt.getTime(), updated.packageAssignedAt.getTime());

  db.close();
});

// --- Timestamp behavior -------------------------------------------------

test("package assignment: non-package updates preserve the timestamp", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold");
  const clients = new SqliteClientRepository(db);
  const client = await createClient(db, pkg.id);
  const assignedAt = client.packageAssignedAt.getTime();

  await clients.update(client.id, { name: "Renamed Client" });
  await clients.update(client.id, { isActive: false });

  const reloaded = await clients.findById(client.id);
  assert.equal(reloaded?.name, "Renamed Client");
  assert.equal(reloaded?.isActive, false);
  assert.equal(reloaded?.packageAssignedAt.getTime(), assignedAt);

  db.close();
});

test("package assignment: updating with the same package preserves the timestamp", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold");
  const clients = new SqliteClientRepository(db);
  const client = await createClient(db, pkg.id);
  const assignedAt = client.packageAssignedAt.getTime();

  // Passing the same packageId is not a reassignment.
  await clients.update(client.id, { packageId: pkg.id });

  const reloaded = await clients.findById(client.id);
  assert.equal(reloaded?.packageId, pkg.id);
  assert.equal(reloaded?.packageAssignedAt.getTime(), assignedAt);

  db.close();
});

test("package assignment: an explicit packageAssignedAt is honored on reassignment", async () => {
  const db = createTestDb();
  const pkgA = await createPackage(db, "bronze", "Bronze");
  const pkgB = await createPackage(db, "gold", "Gold");
  const clients = new SqliteClientRepository(db);
  const client = await createClient(db, pkgA.id);

  const backdated = new Date("2026-01-15T00:00:00.000Z");
  const updated = await clients.update(client.id, {
    packageId: pkgB.id,
    packageAssignedAt: backdated,
  });

  assert.equal(updated.packageId, pkgB.id);
  assert.equal(updated.packageAssignedAt.getTime(), backdated.getTime());

  db.close();
});

// --- Missing package safety ---------------------------------------------

test("package assignment: assigning to a missing package is rejected", async () => {
  const db = createTestDb();
  const pkgA = await createPackage(db, "bronze", "Bronze");
  const clients = new SqliteClientRepository(db);
  const client = await createClient(db, pkgA.id);

  await assert.rejects(
    clients.update(client.id, { packageId: "no-such-package" }),
    /Package not found/
  );

  // Nothing changed.
  const reloaded = await clients.findById(client.id);
  assert.equal(reloaded?.packageId, pkgA.id);

  db.close();
});

test("package assignment: a client with a dangling package still reads back safely", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold");
  const clients = new SqliteClientRepository(db);
  const client = await createClient(db, pkg.id);
  const assignedAt = client.packageAssignedAt.getTime();

  // Simulate the package being deleted out from under the client (the
  // migration backfill still guarantees packageAssignedAt is set).
  db.pragma("foreign_keys = OFF");
  db.prepare("DELETE FROM packages WHERE id = ?").run(pkg.id);
  db.pragma("foreign_keys = ON");

  const reloaded = await clients.findById(client.id);
  assert.ok(reloaded);
  assert.equal(reloaded.packageId, pkg.id);
  assert.equal(reloaded.packageAssignedAt.getTime(), assignedAt);

  db.close();
});

test("package assignment: legacy rows without the column fall back to created_at", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold");
  const createdAt = "2026-01-01T00:00:00.000Z";

  // A row written as if migration 007 had never run (no
  // package_assigned_at value).
  db.prepare(
    `INSERT INTO clients (id, name, business_type, contact_email, package_id, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "legacy-client-id",
    "Legacy Client",
    "General",
    "legacy@example.com",
    pkg.id,
    1,
    createdAt
  );

  const found = await new SqliteClientRepository(db).findById("legacy-client-id");
  assert.ok(found);
  assert.equal(
    found.packageAssignedAt.getTime(),
    new Date(createdAt).getTime()
  );

  db.close();
});

// --- Preservation of pricing / raw metrics ------------------------------

test("package assignment: reassignment preserves pricing rules and raw snapshots", async () => {
  const db = createTestDb();
  const pkgA = await createPackage(db, "bronze", "Bronze");
  const pkgB = await createPackage(db, "gold", "Gold");

  const clients = new SqliteClientRepository(db);
  const adAccounts = new SqliteAdAccountRepository(db);
  const campaigns = new SqliteCampaignRepository(db);
  const snapshots = new SqliteInsightSnapshotRepository(db);
  const pricing = new SqlitePricingRuleRepository(db);

  const client = await createClient(db, pkgA.id);

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
  const snapshot = await snapshots.append({
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
  const rule = await pricing.create({
    clientId: client.id,
    metric: "cpm",
    percentageMarkup: null,
    fixedMarkup: 1.0,
    minimumCustomerValue: null,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
  });

  // Reassign the client to the other package — a lifecycle event that
  // must never touch pricing rules or raw insight data.
  await clients.update(client.id, { packageId: pkgB.id });

  const rules = await pricing.findByClient(client.id);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].id, rule.id);
  assert.equal(rules[0].fixedMarkup, 1.0);

  const raw = await snapshots.findLatestForCampaign(campaign.id);
  assert.equal(raw?.id, snapshot.id);
  assert.equal(raw?.spend, 125);
  assert.equal(raw?.cpm, 12.5);
  assert.equal(raw?.cpc, 0.25);
  assert.equal(raw?.impressions, 10000);
  assert.deepEqual(raw?.rawPayload, { test: true });

  db.close();
});