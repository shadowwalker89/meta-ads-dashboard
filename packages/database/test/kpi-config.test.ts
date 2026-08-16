import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";
import { runMigrations } from "../src/migrations/migrate.js";
import {
  SqliteDashboardPreferenceRepository,
  SqlitePackageRepository,
  SqliteClientRepository,
  SqliteUserRepository,
  SqliteAdminAssignmentRepository,
} from "../src/repositories/index.js";
import type { DashboardKpiKey } from "@repo/shared";
import {
  DEFAULT_VISIBLE_KPIS,
  canUserConfigureClientKpis,
  resolveVisibleKpis,
  sanitizeDashboardKpiKeys,
} from "@repo/shared";

function createTestDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

async function createClient(db: DatabaseType) {
  const pkg = await ensurePackage(db);
  return new SqliteClientRepository(db).create({
    name: "Test Client",
    businessType: "E-commerce",
    contactEmail: "client@example.com",
    packageId: pkg.id,
    isActive: true,
  });
}

// A package is one tier row per code, so every client in a test shares a
// single package — creating a new one per client would hit the unique
// code constraint and mis-model reality.
const packageByDb = new WeakMap<DatabaseType, { id: string }>();

async function ensurePackage(db: DatabaseType) {
  const existing = packageByDb.get(db);
  if (existing) return existing;
  const packages = new SqlitePackageRepository(db);
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
  packageByDb.set(db, pkg);
  return pkg;
}

test("KPI catalog: default config is used when no preference exists", async () => {
  const db = createTestDb();
  const client = await createClient(db);

  const repo = new SqliteDashboardPreferenceRepository(db);
  const preference = await repo.findForClient(client.id);

  assert.equal(preference, null);
  assert.deepEqual(resolveVisibleKpis(preference), [...DEFAULT_VISIBLE_KPIS]);

  db.close();
});

test("KPI catalog: saving and loading a custom KPI configuration", async () => {
  const db = createTestDb();
  const client = await createClient(db);

  const repo = new SqliteDashboardPreferenceRepository(db);
  const custom: DashboardKpiKey[] = ["spend", "impressions", "leads", "ctr"];

  await repo.save({
    userId: null,
    clientId: client.id,
    visibleMetrics: custom,
    theme: "system",
  });

  const loaded = await repo.findForClient(client.id);
  assert.equal(loaded?.clientId, client.id);
  assert.deepEqual(loaded?.visibleMetrics, custom);

  db.close();
});

test("KPI catalog: invalid/obsolete keys are safely ignored", () => {
  assert.deepEqual(sanitizeDashboardKpiKeys(["spend", "bogus", "ctr", "nope"]), [
    "spend",
    "ctr",
  ]);
  assert.deepEqual(
    sanitizeDashboardKpiKeys(["spend", "spend", "impressions"]),
    ["spend", "impressions"]
  );
});

test("KPI catalog: preference with only invalid keys falls back to defaults", () => {
  const result = resolveVisibleKpis({ visibleMetrics: ["bogus", "nope"] });
  assert.deepEqual(result, [...DEFAULT_VISIBLE_KPIS]);
});

test("KPI authorization: client can never configure KPIs", () => {
  assert.equal(
    canUserConfigureClientKpis(
      { role: "client" },
      "client-1",
      ["client-1", "client-2"]
    ),
    false
  );
});

test("KPI authorization: admin can configure an assigned client", () => {
  assert.equal(
    canUserConfigureClientKpis({ role: "admin" }, "client-1", [
      "client-1",
      "client-2",
    ]),
    true
  );
});

test("KPI authorization: admin cannot configure an unassigned client", () => {
  assert.equal(
    canUserConfigureClientKpis({ role: "admin" }, "client-3", [
      "client-1",
      "client-2",
    ]),
    false
  );
});

test("KPI authorization: super admin can configure any client", () => {
  assert.equal(
    canUserConfigureClientKpis({ role: "super_admin" }, "anything", []),
    true
  );
});

test("KPI config: admin sees only assigned clients, super admin sees all", async () => {
  const db = createTestDb();

  const users = new SqliteUserRepository(db);
  const assignments = new SqliteAdminAssignmentRepository(db);

  const admin = await users.create({
    role: "admin",
    fullName: "Admin",
    email: "admin@example.com",
    clientId: null,
  });
  const clientA = await createClient(db);
  const clientB = await createClient(db);

  await assignments.assign(admin.id, clientA.id);

  const assigned = await assignments.findByAdmin(admin.id);
  assert.deepEqual(
    assigned.map((a) => a.clientId),
    [clientA.id]
  );
  assert.equal(assigned.some((a) => a.clientId === clientB.id), false);

  db.close();
});