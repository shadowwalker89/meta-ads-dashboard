import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { DashboardKpiKey, Package } from "@repo/shared";
import { DEFAULT_VISIBLE_KPIS } from "@repo/shared";
import {
  openDatabase,
  runMigrations,
  SqliteClientRepository,
  SqliteDashboardPreferenceRepository,
  SqlitePackageRepository,
} from "@repo/database";
import {
  resolveClientPackageSettings,
  type ClientPackageResolutionInput,
} from "@/lib/package-settings";
import { getClientKpiConfiguration } from "@/lib/kpi-config";

function makePackage(overrides: Partial<Package> = {}): Package {
  return {
    id: "pkg-1",
    name: "Gold",
    description: "Gold plan",
    code: "gold",
    collectionFrequency: 12,
    maxAdAccounts: 5,
    maxCampaigns: 50,
    retentionDays: 90,
    defaultVisibleKpis: ["spend", "impressions", "ctr"],
    features: { charts: true, dataExport: true, advancedReporting: true },
    pricingDefaults: {
      cpm: { percentageMarkup: null, fixedMarkup: 1.0, minimumCustomerValue: null },
    },
    metricThresholds: {},
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function resolve(overrides: Partial<ClientPackageResolutionInput> = {}) {
  return resolveClientPackageSettings({
    clientId: "client-1",
    packageId: "pkg-1",
    clientPreference: null,
    pkg: makePackage(),
    ...overrides,
  });
}

test("package settings: client preference wins over package default for KPI visibility", () => {
  const settings = resolve({
    clientPreference: { visibleMetrics: ["leads", "ctr"] },
  });
  assert.deepEqual(settings.visibleKpis, ["leads", "ctr"]);
});

test("package settings: package default KPIs apply when no client preference exists", () => {
  const settings = resolve({ clientPreference: null });
  assert.deepEqual(settings.visibleKpis, ["spend", "impressions", "ctr"]);
});

test("package settings: invalid keys in the client preference fall through to the package default", () => {
  const settings = resolve({
    clientPreference: { visibleMetrics: ["bogus", "nope"] },
  });
  assert.deepEqual(settings.visibleKpis, ["spend", "impressions", "ctr"]);
});

test("package settings: global default KPIs apply when neither preference nor package default exist", () => {
  const settings = resolve({ pkg: makePackage({ defaultVisibleKpis: [] }) });
  assert.deepEqual(settings.visibleKpis, [...DEFAULT_VISIBLE_KPIS]);
});

test("package settings: collection frequency is package-authoritative", () => {
  const settings = resolve({ pkg: makePackage({ collectionFrequency: 4 }) });
  assert.equal(settings.collectionFrequency, 4);
});

test("package settings: ad-account and campaign limits come from the package", () => {
  const settings = resolve({
    pkg: makePackage({ maxAdAccounts: 3, maxCampaigns: 20 }),
  });
  assert.equal(settings.maxAdAccounts, 3);
  assert.equal(settings.maxCampaigns, 20);
});

test("package settings: retention days come from the package", () => {
  const settings = resolve({ pkg: makePackage({ retentionDays: 30 }) });
  assert.equal(settings.retentionDays, 30);
});

test("package settings: features come from the package", () => {
  const settings = resolve({
    pkg: makePackage({ features: { charts: false, dataExport: true, advancedReporting: false } }),
  });
  assert.deepEqual(settings.features, {
    charts: false,
    dataExport: true,
    advancedReporting: false,
  });
});

test("package settings: pricing defaults come from the package", () => {
  const settings = resolve();
  assert.deepEqual(settings.pricingDefaults, {
    cpm: { percentageMarkup: null, fixedMarkup: 1.0, minimumCustomerValue: null },
  });
});

test("package settings: a client with no package falls back to conservative defaults", () => {
  const settings = resolve({ packageId: null, pkg: null });
  assert.equal(settings.code, null);
  assert.equal(settings.collectionFrequency, 1);
  assert.equal(settings.maxAdAccounts, null);
  assert.equal(settings.maxCampaigns, null);
  assert.equal(settings.retentionDays, null);
  assert.deepEqual(settings.visibleKpis, [...DEFAULT_VISIBLE_KPIS]);
  assert.deepEqual(settings.features, {
    charts: false,
    dataExport: false,
    advancedReporting: false,
  });
  assert.deepEqual(settings.pricingDefaults, {});
});

test("package settings: a package with a null code still resolves safely", () => {
  const settings = resolve({ pkg: makePackage({ code: null }) });
  assert.equal(settings.code, null);
  assert.equal(settings.collectionFrequency, 12);
});

// ---------------------------------------------------------------------------
// Real dashboard path: getClientKpiConfiguration() must resolve through the
// package default, exactly like the pure resolver above.
// ---------------------------------------------------------------------------

type Db = ReturnType<typeof openDatabase>;

function createTestDb(): Db {
  const db = openDatabase(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

async function createPackageRow(
  db: Db,
  overrides: Partial<Package> = {}
): Promise<Package> {
  return new SqlitePackageRepository(db).create({
    name: "Gold",
    description: "Gold plan",
    code: "gold",
    collectionFrequency: 1,
    maxAdAccounts: null,
    maxCampaigns: null,
    retentionDays: null,
    defaultVisibleKpis: [],
    features: { charts: false, dataExport: false, advancedReporting: false },
    pricingDefaults: {},
    metricThresholds: {},
    ...overrides,
  });
}

async function createClientRow(db: Db, packageId: string): Promise<string> {
  const client = await new SqliteClientRepository(db).create({
    name: "Test Client",
    businessType: "General",
    contactEmail: "client@example.com",
    packageId,
    isActive: true,
  });
  return client.id;
}

test("package settings: dashboard KPI path — explicit preference wins over package default", async () => {
  const db = createTestDb();
  const pkg = await createPackageRow(db, {
    defaultVisibleKpis: ["spend", "impressions", "ctr"],
  });
  const clientId = await createClientRow(db, pkg.id);
  await new SqliteDashboardPreferenceRepository(db).save({
    userId: null,
    clientId,
    visibleMetrics: ["leads", "costPerResult"],
    theme: "system",
  });

  assert.deepEqual(await getClientKpiConfiguration(clientId, db), [
    "leads",
    "costPerResult",
  ]);

  db.close();
});

test("package settings: dashboard KPI path — package default wins when no preference exists", async () => {
  const db = createTestDb();
  const pkg = await createPackageRow(db, {
    defaultVisibleKpis: ["spend", "impressions", "ctr"],
  });
  const clientId = await createClientRow(db, pkg.id);

  assert.deepEqual(await getClientKpiConfiguration(clientId, db), [
    "spend",
    "impressions",
    "ctr",
  ]);

  db.close();
});

test("package settings: dashboard KPI path — global default wins when neither exists", async () => {
  const db = createTestDb();
  const pkg = await createPackageRow(db, { defaultVisibleKpis: [] });
  const clientId = await createClientRow(db, pkg.id);

  assert.deepEqual(await getClientKpiConfiguration(clientId, db), [
    ...DEFAULT_VISIBLE_KPIS,
  ]);

  db.close();
});

test("package settings: dashboard KPI path — invalid preference keys fall through to the package default", async () => {
  const db = createTestDb();
  const pkg = await createPackageRow(db, {
    defaultVisibleKpis: ["spend", "impressions", "ctr"],
  });
  const clientId = await createClientRow(db, pkg.id);
  await new SqliteDashboardPreferenceRepository(db).save({
    userId: null,
    clientId,
    visibleMetrics: ["bogus", "nope"] as unknown as DashboardKpiKey[],
    theme: "system",
  });

  assert.deepEqual(await getClientKpiConfiguration(clientId, db), [
    "spend",
    "impressions",
    "ctr",
  ]);

  db.close();
});

test("package settings: dashboard KPI path — costPerResult visibility follows the same precedence", async () => {
  const db = createTestDb();
  const pkg = await createPackageRow(db, {
    defaultVisibleKpis: ["spend", "costPerResult"],
  });
  const clientId = await createClientRow(db, pkg.id);

  // Package default exposes costPerResult to a client with no preference.
  assert.deepEqual(await getClientKpiConfiguration(clientId, db), [
    "spend",
    "costPerResult",
  ]);

  // An explicit preference without costPerResult hides it.
  await new SqliteDashboardPreferenceRepository(db).save({
    userId: null,
    clientId,
    visibleMetrics: ["spend", "clicks"],
    theme: "system",
  });
  assert.deepEqual(await getClientKpiConfiguration(clientId, db), [
    "spend",
    "clicks",
  ]);

  db.close();
});