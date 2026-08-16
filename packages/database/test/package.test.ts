import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { runMigrations } from "../src/migrations/migrate.js";
import { SqlitePackageRepository } from "../src/repositories/index.js";
import type { DashboardKpiKey, Package } from "@repo/shared";

function createTestDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

function packageInput(
  overrides: Partial<Omit<Package, "id" | "createdAt">> = {}
): Omit<Package, "id" | "createdAt"> {
  return {
    name: "Gold",
    description: "Gold plan",
    code: "gold",
    collectionFrequency: 12,
    maxAdAccounts: 5,
    maxCampaigns: 50,
    retentionDays: 90,
    defaultVisibleKpis: ["spend", "impressions", "clicks"],
    features: { charts: true, dataExport: true, advancedReporting: false },
    pricingDefaults: {
      cpm: { percentageMarkup: null, fixedMarkup: 1.0, minimumCustomerValue: 0.5 },
    },
    metricThresholds: {},
    ...overrides,
  };
}

test("package: full settings round-trip through create and findById", async () => {
  const db = createTestDb();
  const repo = new SqlitePackageRepository(db);

  const created = await repo.create(packageInput());
  assert.ok(created.id);
  assert.ok(created.createdAt instanceof Date);

  const found = await repo.findById(created.id);
  assert.ok(found);
  assert.equal(found.name, "Gold");
  assert.equal(found.code, "gold");
  assert.equal(found.collectionFrequency, 12);
  assert.equal(found.maxAdAccounts, 5);
  assert.equal(found.maxCampaigns, 50);
  assert.equal(found.retentionDays, 90);
  assert.deepEqual(found.defaultVisibleKpis, ["spend", "impressions", "clicks"]);
  assert.deepEqual(found.features, {
    charts: true,
    dataExport: true,
    advancedReporting: false,
  });
  assert.deepEqual(found.pricingDefaults, {
    cpm: { percentageMarkup: null, fixedMarkup: 1.0, minimumCustomerValue: 0.5 },
  });

  db.close();
});

test("package: findByCode matches the stable code and null for unknown", async () => {
  const db = createTestDb();
  const repo = new SqlitePackageRepository(db);

  const bronze = await repo.create(
    packageInput({ name: "Bronze", code: "bronze", collectionFrequency: 1 })
  );
  await repo.create(packageInput());

  const found = await repo.findByCode("bronze");
  assert.equal(found?.id, bronze.id);
  assert.equal(await repo.findByCode("platinum"), null);

  db.close();
});

test("package: KPI defaults are preserved and invalid keys are dropped", async () => {
  const db = createTestDb();
  const repo = new SqlitePackageRepository(db);

  const created = await repo.create(
    packageInput({ defaultVisibleKpis: ["spend", "bogus" as DashboardKpiKey, "ctr", "ctr"] })
  );
  const found = await repo.findById(created.id);
  assert.deepEqual(found?.defaultVisibleKpis, ["spend", "ctr"]);

  db.close();
});

test("package: collection frequency is preserved and must be positive", async () => {
  const db = createTestDb();
  const repo = new SqlitePackageRepository(db);

  const created = await repo.create(packageInput({ collectionFrequency: 4 }));
  const found = await repo.findById(created.id);
  assert.equal(found?.collectionFrequency, 4);

  await assert.rejects(
    repo.create(packageInput({ collectionFrequency: 0 })),
    /positive collection frequency/
  );
  await assert.rejects(
    repo.create(packageInput({ collectionFrequency: -1 })),
    /positive collection frequency/
  );

  db.close();
});

test("package: limits round-trip including unlimited (null)", async () => {
  const db = createTestDb();
  const repo = new SqlitePackageRepository(db);

  const limited = await repo.create(
    packageInput({ maxAdAccounts: 3, maxCampaigns: 20, retentionDays: 30 })
  );
  const found = await repo.findById(limited.id);
  assert.equal(found?.maxAdAccounts, 3);
  assert.equal(found?.maxCampaigns, 20);
  assert.equal(found?.retentionDays, 30);

  const unlimited = await repo.create(
    packageInput({ name: "Bronze", code: "bronze", maxAdAccounts: null, maxCampaigns: null, retentionDays: null })
  );
  const foundUnlimited = await repo.findById(unlimited.id);
  assert.equal(foundUnlimited?.maxAdAccounts, null);
  assert.equal(foundUnlimited?.maxCampaigns, null);
  assert.equal(foundUnlimited?.retentionDays, null);

  db.close();
});

test("package: feature configuration round-trips", async () => {
  const db = createTestDb();
  const repo = new SqlitePackageRepository(db);

  const created = await repo.create(
    packageInput({ features: { charts: false, dataExport: true, advancedReporting: true } })
  );
  const found = await repo.findById(created.id);
  assert.deepEqual(found?.features, {
    charts: false,
    dataExport: true,
    advancedReporting: true,
  });

  db.close();
});

test("package: pricing defaults round-trip and reject non-pricable metrics", async () => {
  const db = createTestDb();
  const repo = new SqlitePackageRepository(db);

  const created = await repo.create(
    packageInput({
      pricingDefaults: {
        cpm: { percentageMarkup: null, fixedMarkup: 1.0, minimumCustomerValue: null },
        cpc: { percentageMarkup: 0.4, fixedMarkup: null, minimumCustomerValue: null },
        // Non-pricable metric and an empty config must be dropped.
        impressions: { percentageMarkup: 0.1, fixedMarkup: null, minimumCustomerValue: null },
        spend: { percentageMarkup: null, fixedMarkup: null, minimumCustomerValue: null },
      },
    })
  );

  const found = await repo.findById(created.id);
  assert.deepEqual(found?.pricingDefaults, {
    cpm: { percentageMarkup: null, fixedMarkup: 1.0, minimumCustomerValue: null },
    cpc: { percentageMarkup: 0.4, fixedMarkup: null, minimumCustomerValue: null },
  });

  db.close();
});

test("package: create rejects a missing or empty code", async () => {
  const db = createTestDb();
  const repo = new SqlitePackageRepository(db);

  await assert.rejects(
    repo.create(packageInput({ code: null })),
    /non-empty code/
  );
  await assert.rejects(
    repo.create(packageInput({ code: "  " })),
    /non-empty code/
  );

  db.close();
});

test("package: update rewrites settings and preserves untouched fields", async () => {
  const db = createTestDb();
  const repo = new SqlitePackageRepository(db);

  const created = await repo.create(packageInput());
  const updated = await repo.update(created.id, { collectionFrequency: 4, maxCampaigns: 25 });

  assert.equal(updated.collectionFrequency, 4);
  assert.equal(updated.maxCampaigns, 25);
  assert.equal(updated.maxAdAccounts, 5);
  assert.equal(updated.code, "gold");
  assert.equal(updated.name, "Gold");

  const found = await repo.findById(created.id);
  assert.equal(found?.collectionFrequency, 4);
  assert.equal(found?.maxCampaigns, 25);

  db.close();
});

test("package: legacy rows (pre-settings columns) read back safely", async () => {
  const db = createTestDb();
  const repo = new SqlitePackageRepository(db);

  // Simulate a row created before migration 006 existed: only the
  // original columns are written. SQLite column defaults fill the rest.
  db.prepare(
    `INSERT INTO packages (id, name, description, metric_thresholds, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    "legacy-package-id",
    "Legacy Plan",
    "created before package settings",
    JSON.stringify({ minViews: 1000 }),
    "2026-01-01T00:00:00.000Z"
  );

  const found = await repo.findById("legacy-package-id");
  assert.ok(found);
  assert.equal(found.code, null);
  assert.equal(found.collectionFrequency, 1);
  assert.equal(found.maxAdAccounts, null);
  assert.equal(found.maxCampaigns, null);
  assert.equal(found.retentionDays, null);
  assert.deepEqual(found.defaultVisibleKpis, []);
  assert.deepEqual(found.features, {
    charts: false,
    dataExport: false,
    advancedReporting: false,
  });
  assert.deepEqual(found.pricingDefaults, {});
  assert.deepEqual(found.metricThresholds, { minViews: 1000 });

  db.close();
});

test("package: corrupt JSON settings read back as safe defaults", async () => {
  const db = createTestDb();
  const repo = new SqlitePackageRepository(db);

  const created = await repo.create(packageInput());
  db.prepare(
    `UPDATE packages
     SET default_visible_kpis = ?, features = ?, pricing_defaults = ?
     WHERE id = ?`
  ).run("not-json", "not-json", "not-json", created.id);

  const found = await repo.findById(created.id);
  assert.deepEqual(found?.defaultVisibleKpis, []);
  assert.deepEqual(found?.features, {
    charts: false,
    dataExport: false,
    advancedReporting: false,
  });
  assert.deepEqual(found?.pricingDefaults, {});

  db.close();
});