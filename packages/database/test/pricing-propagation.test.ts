import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";
import { runMigrations } from "../src/migrations/migrate.js";
import { PackagePricingPropagation } from "../src/services/package-pricing-propagation.js";
import {
  SqliteAdAccountRepository,
  SqliteCampaignRepository,
  SqliteClientRepository,
  SqliteInsightSnapshotRepository,
  SqlitePackageRepository,
  SqlitePricingRuleRepository,
} from "../src/repositories/index.js";
import type { PackagePricingDefaults, PricingMetric } from "@repo/shared";
import { applyPricingRule } from "@repo/shared";

function createTestDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

function createPackage(
  db: DatabaseType,
  code: string,
  name: string,
  pricingDefaults: PackagePricingDefaults
) {
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
    pricingDefaults,
    metricThresholds: {},
  });
}

async function createClient(db: DatabaseType, packageId: string) {
  return new SqliteClientRepository(db).create({
    name: "Test Client",
    businessType: "E-commerce",
    contactEmail: "client@example.com",
    packageId,
    isActive: true,
  });
}

async function createCampaignWithSnapshot(db: DatabaseType, clientId: string) {
  const adAccounts = new SqliteAdAccountRepository(db);
  const campaigns = new SqliteCampaignRepository(db);
  const snapshots = new SqliteInsightSnapshotRepository(db);

  const adAccount = await adAccounts.create({
    clientId,
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

  return { campaignId: campaign.id, snapshotId: snapshot.id };
}

// --- Initial propagation ------------------------------------------------

test("pricing propagation: initial assignment materializes the package defaults", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold", {
    cpm: { percentageMarkup: null, fixedMarkup: 1.0, minimumCustomerValue: null },
    cpc: { percentageMarkup: 0.4, fixedMarkup: null, minimumCustomerValue: null },
  });
  const client = await createClient(db, pkg.id);

  const propagation = new PackagePricingPropagation(db);
  const created = await propagation.propagateForClient(client.id);
  assert.equal(created, 2);

  const rules = await new SqlitePricingRuleRepository(db).findByClient(client.id);
  assert.equal(rules.length, 2);

  const cpm = rules.find((r) => r.metric === "cpm");
  assert.ok(cpm);
  assert.equal(cpm.fixedMarkup, 1.0);
  assert.equal(cpm.percentageMarkup, null);
  assert.equal(
    cpm.effectiveFrom.getTime(),
    client.packageAssignedAt.getTime(),
    "effectiveFrom must be packageAssignedAt"
  );

  const cpc = rules.find((r) => r.metric === "cpc");
  assert.ok(cpc);
  assert.equal(cpc.percentageMarkup, 0.4);

  db.close();
});

// --- Idempotency --------------------------------------------------------

test("pricing propagation: repeated runs create no duplicates", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold", {
    cpm: { percentageMarkup: null, fixedMarkup: 1.0, minimumCustomerValue: null },
  });
  const client = await createClient(db, pkg.id);

  const propagation = new PackagePricingPropagation(db);
  assert.equal(await propagation.propagateForClient(client.id), 1);
  assert.equal(await propagation.propagateForClient(client.id), 0);
  assert.equal(await propagation.propagateForClient(client.id), 0);

  const rules = await new SqlitePricingRuleRepository(db).findByClient(client.id);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].metric, "cpm");

  db.close();
});

// --- Reassignment -------------------------------------------------------

test("pricing propagation: reassignment materializes the new package's defaults as newer rules", async () => {
  const db = createTestDb();
  const pkgA = await createPackage(db, "bronze", "Bronze", {
    cpm: { percentageMarkup: null, fixedMarkup: 1.0, minimumCustomerValue: null },
  });
  const pkgB = await createPackage(db, "gold", "Gold", {
    cpm: { percentageMarkup: null, fixedMarkup: 2.0, minimumCustomerValue: null },
  });

  const clients = new SqliteClientRepository(db);
  const client = await createClient(db, pkgA.id);
  const firstEffectiveFrom = client.packageAssignedAt;

  const propagation = new PackagePricingPropagation(db);
  assert.equal(await propagation.propagateForClient(client.id), 1);

  // Reassign to pkg B at a deterministic later time.
  const reassignedAt = new Date(client.packageAssignedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  await clients.update(client.id, {
    packageId: pkgB.id,
    packageAssignedAt: reassignedAt,
  });

  const created = await propagation.propagateForClient(client.id);
  assert.equal(created, 1);

  const rules = await new SqlitePricingRuleRepository(db).findByClient(client.id);
  assert.equal(rules.length, 2, "append-only: both assignments remain");

  const first = rules.find((r) => r.effectiveFrom.getTime() === firstEffectiveFrom.getTime());
  assert.equal(first?.fixedMarkup, 1.0);

  const second = rules.find((r) => r.effectiveFrom.getTime() === reassignedAt.getTime());
  assert.equal(second?.fixedMarkup, 2.0);

  // The newest rule governs.
  const applicable = await new SqlitePricingRuleRepository(db).findApplicable(
    client.id,
    "cpm",
    new Date(reassignedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
  );
  assert.equal(applicable?.fixedMarkup, 2.0);

  db.close();
});

// --- Multiple metrics ---------------------------------------------------

test("pricing propagation: a default per pricable metric becomes a rule per metric", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold", {
    spend: { percentageMarkup: 0.1, fixedMarkup: null, minimumCustomerValue: null },
    cpc: { percentageMarkup: null, fixedMarkup: 0.05, minimumCustomerValue: null },
    cpm: { percentageMarkup: null, fixedMarkup: 1.0, minimumCustomerValue: 0.75 },
    costPerResult: { percentageMarkup: 0.2, fixedMarkup: null, minimumCustomerValue: null },
  });
  const client = await createClient(db, pkg.id);

  const propagation = new PackagePricingPropagation(db);
  assert.equal(await propagation.propagateForClient(client.id), 4);

  const rules = await new SqlitePricingRuleRepository(db).findByClient(client.id);
  assert.equal(rules.length, 4);
  const metrics = new Set(rules.map((r) => r.metric));
  assert.deepEqual(
    [...metrics].sort(),
    ["costPerResult", "cpc", "cpm", "spend"].sort() as PricingMetric[]
  );

  const cpm = rules.find((r) => r.metric === "cpm");
  assert.equal(cpm?.fixedMarkup, 1.0);
  assert.equal(cpm?.minimumCustomerValue, 0.75);

  db.close();
});

// --- Client override precedence ----------------------------------------

test("pricing propagation: a newer client-specific rule remains authoritative", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold", {
    cpm: { percentageMarkup: null, fixedMarkup: 1.0, minimumCustomerValue: null },
  });
  const client = await createClient(db, pkg.id);

  const propagation = new PackagePricingPropagation(db);
  assert.equal(await propagation.propagateForClient(client.id), 1);

  // Admin applies a client-specific override that is newer than the
  // package default's effectiveFrom.
  const pricing = new SqlitePricingRuleRepository(db);
  const overrideAt = new Date(client.packageAssignedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  await pricing.create({
    clientId: client.id,
    metric: "cpm",
    percentageMarkup: null,
    fixedMarkup: 2.0,
    minimumCustomerValue: null,
    effectiveFrom: overrideAt,
  });

  // Re-running propagation creates nothing and never shadows the override.
  assert.equal(await propagation.propagateForClient(client.id), 0);
  assert.equal(await propagation.propagateForClient(client.id), 0);

  const rules = await pricing.findByClient(client.id);
  assert.equal(rules.length, 2);

  const applicable = await pricing.findApplicable(
    client.id,
    "cpm",
    new Date(overrideAt.getTime() + 30 * 24 * 60 * 60 * 1000)
  );
  assert.equal(applicable?.fixedMarkup, 2.0);

  db.close();
});

// --- Empty / sanitized defaults -----------------------------------------

test("pricing propagation: empty defaults create nothing", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "bronze", "Bronze", {});
  const client = await createClient(db, pkg.id);

  const propagation = new PackagePricingPropagation(db);
  assert.equal(await propagation.propagateForClient(client.id), 0);

  const rules = await new SqlitePricingRuleRepository(db).findByClient(client.id);
  assert.equal(rules.length, 0);

  db.close();
});

test("pricing propagation: defaults that sanitize to nothing are a safe no-op", async () => {
  const db = createTestDb();
  // All-null components are dropped by sanitization (matching
  // hasPricingComponents) — the repository also stores them as {}.
  const pkg = await createPackage(db, "bronze", "Bronze", {
    cpm: { percentageMarkup: null, fixedMarkup: null, minimumCustomerValue: null },
    impressions: { percentageMarkup: 0.1, fixedMarkup: null, minimumCustomerValue: null },
  });
  const client = await createClient(db, pkg.id);

  const propagation = new PackagePricingPropagation(db);
  assert.equal(await propagation.propagateForClient(client.id), 0);

  const rules = await new SqlitePricingRuleRepository(db).findByClient(client.id);
  assert.equal(rules.length, 0);

  db.close();
});

// --- Raw Meta preservation ---------------------------------------------

test("pricing propagation: never touches raw snapshots or existing rules", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold", {
    cpm: { percentageMarkup: null, fixedMarkup: 1.0, minimumCustomerValue: null },
    spend: { percentageMarkup: 0.1, fixedMarkup: null, minimumCustomerValue: null },
  });
  const client = await createClient(db, pkg.id);
  const { campaignId, snapshotId } = await createCampaignWithSnapshot(db, client.id);

  const pricing = new SqlitePricingRuleRepository(db);
  // A pre-existing rule that predates the assignment — must survive.
  const older = await pricing.create({
    clientId: client.id,
    metric: "cpc",
    percentageMarkup: null,
    fixedMarkup: 0.05,
    minimumCustomerValue: null,
    effectiveFrom: new Date("2025-12-01T00:00:00.000Z"),
  });

  const propagation = new PackagePricingPropagation(db);
  assert.equal(await propagation.propagateForClient(client.id), 2);

  const snapshots = new SqliteInsightSnapshotRepository(db);
  const raw = await snapshots.findLatestForCampaign(campaignId);
  assert.equal(raw?.id, snapshotId);
  assert.equal(raw?.cpm, 12.5);
  assert.equal(raw?.spend, 125);
  assert.equal(raw?.cpc, 0.25);
  assert.deepEqual(raw?.rawPayload, { test: true });

  const rules = await pricing.findByClient(client.id);
  assert.equal(rules.length, 3);
  const olderReloaded = rules.find((r) => r.id === older.id);
  assert.equal(olderReloaded?.fixedMarkup, 0.05);

  // The propagated rules still feed the unchanged pricing formula.
  const cpmRule = rules.find((r) => r.metric === "cpm");
  assert.ok(cpmRule);
  assert.equal(applyPricingRule(cpmRule, raw!.cpm), 13.5);

  db.close();
});

// --- Missing package safety --------------------------------------------

test("pricing propagation: a dangling package is a safe no-op", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold", {
    cpm: { percentageMarkup: null, fixedMarkup: 1.0, minimumCustomerValue: null },
  });
  const client = await createClient(db, pkg.id);

  db.pragma("foreign_keys = OFF");
  db.prepare("DELETE FROM packages WHERE id = ?").run(pkg.id);
  db.pragma("foreign_keys = ON");

  const propagation = new PackagePricingPropagation(db);
  assert.equal(await propagation.propagateForClient(client.id), 0);

  const rules = await new SqlitePricingRuleRepository(db).findByClient(client.id);
  assert.equal(rules.length, 0);

  db.close();
});

test("pricing propagation: a missing client throws", async () => {
  const db = createTestDb();
  const propagation = new PackagePricingPropagation(db);
  await assert.rejects(
    propagation.propagateForClient("no-such-client"),
    /Client not found/
  );
  db.close();
});