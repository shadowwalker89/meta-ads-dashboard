import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";
import { runMigrations } from "../src/migrations/migrate.js";
import { PackageAssignmentService } from "../src/services/package-assignment.service.js";
import {
  SqliteAdAccountRepository,
  SqliteCampaignRepository,
  SqliteClientRepository,
  SqliteInsightSnapshotRepository,
  SqlitePackageRepository,
  SqlitePricingRuleRepository,
} from "../src/repositories/index.js";
import type { PackagePricingDefaults, UserRole } from "@repo/shared";

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
  pricingDefaults: PackagePricingDefaults = {}
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

// --- Authorization ------------------------------------------------------

test("package assignment service: super admin can assign a package", async () => {
  const db = createTestDb();
  const pkgA = await createPackage(db, "bronze", "Bronze");
  const pkgB = await createPackage(db, "gold", "Gold", {
    cpm: { percentageMarkup: null, fixedMarkup: 1.0, minimumCustomerValue: null },
    cpc: { percentageMarkup: 0.4, fixedMarkup: null, minimumCustomerValue: null },
  });
  const client = await createClient(db, pkgA.id);

  const service = new PackageAssignmentService(db);
  const result = await service.assignPackage({
    actorRole: "super_admin",
    clientId: client.id,
    packageId: pkgB.id,
  });

  assert.equal(result.changed, true);
  assert.equal(result.packageId, pkgB.id);
  assert.equal(result.pricingRulesCreated, 2);
  assert.ok(
    result.packageAssignedAt.getTime() >= client.packageAssignedAt.getTime(),
    "reassignment must refresh packageAssignedAt"
  );

  const reloaded = await new SqliteClientRepository(db).findById(client.id);
  assert.equal(reloaded?.packageId, pkgB.id);

  db.close();
});

test("package assignment service: non-super-admin actors are rejected", async () => {
  const db = createTestDb();
  const pkgA = await createPackage(db, "bronze", "Bronze");
  const pkgB = await createPackage(db, "gold", "Gold");
  const client = await createClient(db, pkgA.id);

  const service = new PackageAssignmentService(db);
  const roles: UserRole[] = ["admin", "client"];
  for (const role of roles) {
    await assert.rejects(
      service.assignPackage({
        actorRole: role,
        clientId: client.id,
        packageId: pkgB.id,
      }),
      /Only super admin/
    );
  }

  // Nothing changed.
  const reloaded = await new SqliteClientRepository(db).findById(client.id);
  assert.equal(reloaded?.packageId, pkgA.id);

  db.close();
});

// --- Target validation ---------------------------------------------------

test("package assignment service: a missing client is rejected", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold");
  const service = new PackageAssignmentService(db);

  await assert.rejects(
    service.assignPackage({
      actorRole: "super_admin",
      clientId: "no-such-client",
      packageId: pkg.id,
    }),
    /Client not found/
  );

  db.close();
});

test("package assignment service: a missing package is rejected", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "bronze", "Bronze");
  const client = await createClient(db, pkg.id);

  const service = new PackageAssignmentService(db);
  await assert.rejects(
    service.assignPackage({
      actorRole: "super_admin",
      clientId: client.id,
      packageId: "no-such-package",
    }),
    /Package not found/
  );

  // Nothing changed.
  const reloaded = await new SqliteClientRepository(db).findById(client.id);
  assert.equal(reloaded?.packageId, pkg.id);

  db.close();
});

// --- Initial assignment & propagation ------------------------------------

test("package assignment service: initial assignment materializes the package pricing defaults", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold", {
    cpm: { percentageMarkup: null, fixedMarkup: 1.0, minimumCustomerValue: null },
    cpc: { percentageMarkup: 0.4, fixedMarkup: null, minimumCustomerValue: null },
  });
  const client = await createClient(db, pkg.id);

  const service = new PackageAssignmentService(db);
  const result = await service.assignPackage({
    actorRole: "super_admin",
    clientId: client.id,
    packageId: pkg.id,
  });

  assert.equal(result.changed, false);
  assert.equal(result.pricingRulesCreated, 2);
  assert.equal(
    result.packageAssignedAt.getTime(),
    client.packageAssignedAt.getTime(),
    "same-package must not change the timestamp"
  );

  const rules = await new SqlitePricingRuleRepository(db).findByClient(client.id);
  assert.equal(rules.length, 2);
  const cpm = rules.find((r) => r.metric === "cpm");
  assert.ok(cpm);
  assert.equal(cpm.effectiveFrom.getTime(), client.packageAssignedAt.getTime());
  assert.equal(cpm.fixedMarkup, 1.0);

  db.close();
});

// --- Same-package idempotency -------------------------------------------

test("package assignment service: assigning the same package is idempotent", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold", {
    cpm: { percentageMarkup: null, fixedMarkup: 1.0, minimumCustomerValue: null },
  });
  const client = await createClient(db, pkg.id);

  const service = new PackageAssignmentService(db);
  const first = await service.assignPackage({
    actorRole: "super_admin",
    clientId: client.id,
    packageId: pkg.id,
  });
  assert.equal(first.changed, false);
  assert.equal(first.pricingRulesCreated, 1);

  const second = await service.assignPackage({
    actorRole: "super_admin",
    clientId: client.id,
    packageId: pkg.id,
  });
  assert.equal(second.changed, false);
  assert.equal(second.pricingRulesCreated, 0);
  assert.equal(
    second.packageAssignedAt.getTime(),
    first.packageAssignedAt.getTime(),
    "same-package must never refresh the timestamp"
  );

  const rules = await new SqlitePricingRuleRepository(db).findByClient(client.id);
  assert.equal(rules.length, 1, "no duplicate rules on repeat assignment");

  db.close();
});

// --- Reassignment --------------------------------------------------------

test("package assignment service: reassignment updates packageAssignedAt and propagates the new defaults", async () => {
  const db = createTestDb();
  const pkgA = await createPackage(db, "bronze", "Bronze");
  const pkgB = await createPackage(db, "gold", "Gold", {
    cpm: { percentageMarkup: null, fixedMarkup: 2.0, minimumCustomerValue: null },
  });
  const client = await createClient(db, pkgA.id);
  const originalAssignedAt = client.packageAssignedAt.getTime();

  const service = new PackageAssignmentService(db);
  const result = await service.assignPackage({
    actorRole: "super_admin",
    clientId: client.id,
    packageId: pkgB.id,
  });

  assert.equal(result.changed, true);
  assert.equal(result.pricingRulesCreated, 1);
  assert.ok(result.packageAssignedAt.getTime() >= originalAssignedAt);

  // The propagated rule uses the NEW assignment timestamp.
  const rules = await new SqlitePricingRuleRepository(db).findByClient(client.id);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].effectiveFrom.getTime(), result.packageAssignedAt.getTime());
  assert.equal(rules[0].fixedMarkup, 2.0);

  const reloaded = await new SqliteClientRepository(db).findById(client.id);
  assert.equal(reloaded?.packageId, pkgB.id);
  assert.equal(reloaded?.packageAssignedAt.getTime(), result.packageAssignedAt.getTime());

  db.close();
});

// --- Client override authority -------------------------------------------

test("package assignment service: a newer client-specific pricing override remains authoritative", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold", {
    cpm: { percentageMarkup: null, fixedMarkup: 1.0, minimumCustomerValue: null },
  });
  const client = await createClient(db, pkg.id);

  const service = new PackageAssignmentService(db);
  await service.assignPackage({
    actorRole: "super_admin",
    clientId: client.id,
    packageId: pkg.id,
  });

  // A client-specific override that is NEWER than the assignment time.
  const pricing = new SqlitePricingRuleRepository(db);
  const overrideAt = new Date(
    client.packageAssignedAt.getTime() + 30 * 24 * 60 * 60 * 1000
  );
  await pricing.create({
    clientId: client.id,
    metric: "cpm",
    percentageMarkup: null,
    fixedMarkup: 2.0,
    minimumCustomerValue: null,
    effectiveFrom: overrideAt,
  });

  // Re-assigning the same package must not duplicate or shadow the override.
  const again = await service.assignPackage({
    actorRole: "super_admin",
    clientId: client.id,
    packageId: pkg.id,
  });
  assert.equal(again.changed, false);
  assert.equal(again.pricingRulesCreated, 0);

  const applicable = await pricing.findApplicable(
    client.id,
    "cpm",
    new Date(overrideAt.getTime() + 1000)
  );
  assert.equal(applicable?.effectiveFrom.getTime(), overrideAt.getTime());
  assert.equal(applicable?.fixedMarkup, 2.0);

  db.close();
});

// --- Raw Meta preservation ----------------------------------------------

test("package assignment service: reassignment leaves raw insight snapshots untouched", async () => {
  const db = createTestDb();
  const pkgA = await createPackage(db, "bronze", "Bronze");
  const pkgB = await createPackage(db, "gold", "Gold");
  const client = await createClient(db, pkgA.id);
  const { campaignId, snapshotId } = await createCampaignWithSnapshot(db, client.id);

  const service = new PackageAssignmentService(db);
  await service.assignPackage({
    actorRole: "super_admin",
    clientId: client.id,
    packageId: pkgB.id,
  });

  const snapshots = new SqliteInsightSnapshotRepository(db);
  const raw = await snapshots.findLatestForCampaign(campaignId);
  assert.equal(raw?.id, snapshotId);
  assert.equal(raw?.spend, 125);
  assert.equal(raw?.cpm, 12.5);
  assert.equal(raw?.cpc, 0.25);
  assert.deepEqual(raw?.rawPayload, { test: true });

  db.close();
});

// --- Failure behavior ----------------------------------------------------

test("package assignment service: a propagation failure leaves a consistent, re-runnable assignment", async () => {
  const db = createTestDb();
  const pkgA = await createPackage(db, "bronze", "Bronze");
  const pkgB = await createPackage(db, "gold", "Gold", {
    cpm: { percentageMarkup: null, fixedMarkup: 1.0, minimumCustomerValue: null },
    cpc: { percentageMarkup: 0.4, fixedMarkup: null, minimumCustomerValue: null },
  });
  const client = await createClient(db, pkgA.id);

  // First attempt: propagation fails AFTER the assignment write. There is
  // no DB transaction (see the service docstring) — the assignment is
  // committed, but the client row stays internally consistent and the
  // operation is recoverable by re-running.
  const failing = new PackageAssignmentService(db, {
    propagateForClient: async () => {
      throw new Error("propagation exploded");
    },
  });
  await assert.rejects(
    failing.assignPackage({
      actorRole: "super_admin",
      clientId: client.id,
      packageId: pkgB.id,
    }),
    /propagation exploded/
  );

  const reloaded = await new SqliteClientRepository(db).findById(client.id);
  assert.ok(reloaded);
  assert.equal(reloaded.packageId, pkgB.id, "assignment itself is committed");
  assert.equal(
    reloaded.packageAssignedAt.getTime(),
    (await new SqliteClientRepository(db).findById(client.id))?.packageAssignedAt.getTime()
  );
  assert.equal(
    (await new SqlitePricingRuleRepository(db).findByClient(client.id)).length,
    0,
    "no rules were materialized before the failure"
  );

  // Re-running with the real propagation completes the missing rules
  // idempotently (a same-package assign still materializes defaults).
  const real = new PackageAssignmentService(db);
  const result = await real.assignPackage({
    actorRole: "super_admin",
    clientId: client.id,
    packageId: pkgB.id,
  });
  assert.equal(result.changed, false);
  assert.equal(result.pricingRulesCreated, 2);

  const rules = await new SqlitePricingRuleRepository(db).findByClient(client.id);
  assert.equal(rules.length, 2);

  db.close();
});