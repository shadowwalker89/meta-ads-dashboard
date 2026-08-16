import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  openDatabase,
  runMigrations,
  SqliteAuditLogRepository,
  SqliteClientRepository,
  SqlitePackageRepository,
  SqliteUserRepository,
} from "@repo/database";
import type { AuditLog } from "@repo/shared";
import type { PackageSettingsInput } from "@/lib/package-settings-input";
import {
  runAssignPackage,
  runCreatePackage,
  runUpdatePackage,
} from "@/lib/package-admin";
import { runCreatePricingRule } from "@/lib/pricing-admin";
import { runSaveClientKpiConfig } from "@/lib/kpi-config";
import { AUDIT_ACTIONS } from "@/lib/audit";

function createTestDb() {
  const db = openDatabase(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

async function createUser(db: ReturnType<typeof openDatabase>) {
  return new SqliteUserRepository(db).create({
    role: "super_admin",
    fullName: "Test Admin",
    email: `admin-${Math.random().toString(36).slice(2)}@example.com`,
    clientId: null,
  });
}

async function createPackage(
  db: ReturnType<typeof openDatabase>,
  code: string,
  name: string
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
    pricingDefaults: {},
    metricThresholds: {},
  });
}

async function createClient(
  db: ReturnType<typeof openDatabase>,
  packageId: string,
  name = "Client One"
) {
  return new SqliteClientRepository(db).create({
    name,
    businessType: "E-commerce",
    contactEmail: "client@example.com",
    packageId,
    isActive: true,
  });
}

function pkgInput(overrides: Partial<PackageSettingsInput> = {}): PackageSettingsInput {
  return {
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
    ...overrides,
  };
}

async function pricingRuleInput(clientId: string) {
  return {
    clientId,
    metric: "cpm" as const,
    percentageMarkup: null,
    fixedMarkup: 1.0,
    minimumCustomerValue: null,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function findEntries(
  db: ReturnType<typeof openDatabase>,
  targetEntityType: string,
  targetEntityId: string
): Promise<{ items: AuditLog[] }> {
  return new SqliteAuditLogRepository(db).findByTarget(targetEntityType, targetEntityId, {
    limit: 100,
  });
}

// --- 1. Successful package assignment -------------------------------------

test("audit trail: successful package assignment creates an audit entry", async () => {
  const db = createTestDb();
  const actor = await createUser(db);
  const pkgA = await createPackage(db, "bronze", "Bronze");
  const pkgB = await createPackage(db, "gold", "Gold");
  const client = await createClient(db, pkgA.id);

  const outcome = await runAssignPackage(
    { role: actor.role, id: actor.id },
    client.id,
    pkgB.id,
    { db }
  );
  assert.equal(outcome.ok, true);

  const { items } = await findEntries(db, "client", client.id);
  assert.equal(items.length, 1);
  const entry = items[0];
  assert.equal(entry.action, AUDIT_ACTIONS.PACKAGE_ASSIGNED);
  assert.equal(entry.actorUserId, actor.id);
  assert.equal(entry.targetEntityType, "client");
  assert.equal(entry.targetEntityId, client.id);
  assert.deepEqual(entry.metadata, {
    previousPackageId: pkgA.id,
    packageId: pkgB.id,
  });

  db.close();
});

// --- 2. Same-package no-op ------------------------------------------------

test("audit trail: same-package assignment does not create a false change audit", async () => {
  const db = createTestDb();
  const actor = await createUser(db);
  const pkg = await createPackage(db, "gold", "Gold");
  const client = await createClient(db, pkg.id);

  const outcome = await runAssignPackage(
    { role: actor.role, id: actor.id },
    client.id,
    pkg.id,
    { db }
  );
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.value.changed, false);

  const { items } = await findEntries(db, "client", client.id);
  assert.equal(items.length, 0, "a same-package no-op must not write an audit entry");

  db.close();
});

// --- 3. Failed assignment -------------------------------------------------

test("audit trail: a failed assignment creates no success audit", async () => {
  const db = createTestDb();
  const actor = await createUser(db);
  const pkgA = await createPackage(db, "bronze", "Bronze");
  const client = await createClient(db, pkgA.id);

  const outcome = await runAssignPackage(
    { role: actor.role, id: actor.id },
    client.id,
    "missing-package",
    { db }
  );
  assert.equal(outcome.ok, false);

  const { items } = await new SqliteAuditLogRepository(db).findByActor(actor.id, {
    limit: 100,
  });
  assert.equal(items.length, 0, "a failed assignment must not produce a success audit");

  db.close();
});

// --- 4. Pricing rule creation ---------------------------------------------

test("audit trail: pricing rule creation creates an audit entry", async () => {
  const db = createTestDb();
  const actor = await createUser(db);
  const pkg = await createPackage(db, "gold", "Gold");
  const client = await createClient(db, pkg.id);

  const outcome = await runCreatePricingRule(
    { role: actor.role, id: actor.id },
    await pricingRuleInput(client.id),
    db
  );
  assert.equal(outcome.ok, true);

  const { items } = await findEntries(db, "client", client.id);
  assert.equal(items.length, 1);
  const entry = items[0];
  assert.equal(entry.action, AUDIT_ACTIONS.PRICING_RULE_CREATED);
  assert.equal(entry.actorUserId, actor.id);
  assert.equal(entry.targetEntityType, "client");
  assert.equal(entry.targetEntityId, client.id);
  const meta = entry.metadata as Record<string, unknown>;
  assert.equal(meta.metric, "cpm");
  assert.equal(meta.fixedMarkup, 1.0);
  assert.equal(meta.percentageMarkup, null);
  assert.equal(meta.minimumCustomerValue, null);
  assert.equal(meta.effectiveFrom, "2026-01-01T00:00:00.000Z");
  assert.equal(typeof meta.ruleId, "string");

  db.close();
});

// --- 5. Package create/update ---------------------------------------------

test("audit trail: package create and update create audit entries", async () => {
  const db = createTestDb();
  const actor = await createUser(db);

  const created = await runCreatePackage(
    { role: actor.role, id: actor.id },
    pkgInput(),
    db
  );
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const updated = await runUpdatePackage(
    { role: actor.role, id: actor.id },
    created.value.id,
    pkgInput({ name: "Gold Pro" }),
    db
  );
  assert.equal(updated.ok, true);

  const { items } = await findEntries(db, "package", created.value.id);
  assert.equal(items.length, 2);
  const actions = items.map((e) => e.action).sort();
  assert.deepEqual(actions, [AUDIT_ACTIONS.PACKAGE_CREATED, AUDIT_ACTIONS.PACKAGE_UPDATED].sort());

  const createdEntry = items.find((e) => e.action === AUDIT_ACTIONS.PACKAGE_CREATED);
  assert.deepEqual(createdEntry?.metadata, { name: "Gold", code: "gold" });
  const updatedEntry = items.find((e) => e.action === AUDIT_ACTIONS.PACKAGE_UPDATED);
  assert.deepEqual(updatedEntry?.metadata, { name: "Gold Pro", code: "gold" });

  db.close();
});

// --- 6. KPI configuration change ------------------------------------------

test("audit trail: KPI configuration change creates an audit entry", async () => {
  const db = createTestDb();
  const actor = await createUser(db);
  const pkg = await createPackage(db, "gold", "Gold");
  const client = await createClient(db, pkg.id);

  const outcome = await runSaveClientKpiConfig(actor, client.id, ["spend", "cpm"], db);
  assert.equal(outcome.ok, true);

  const { items } = await findEntries(db, "client", client.id);
  assert.equal(items.length, 1);
  const entry = items[0];
  assert.equal(entry.action, AUDIT_ACTIONS.KPI_CONFIG_CHANGED);
  assert.deepEqual(entry.metadata, {
    visibleMetrics: ["spend", "cpm"],
    previousVisibleMetrics: [],
  });

  // Re-saving the same set (different order) is not a change — no new entry.
  const unchanged = await runSaveClientKpiConfig(actor, client.id, ["cpm", "spend"], db);
  assert.equal(unchanged.ok, true);
  const after = await findEntries(db, "client", client.id);
  assert.equal(after.items.length, 1, "re-saving the same KPI set must not create a new audit entry");

  db.close();
});

// --- 7. Actor identity ----------------------------------------------------

test("audit trail: actor identity is preserved on every entry", async () => {
  const db = createTestDb();
  const actor = await createUser(db);
  const pkg = await createPackage(db, "gold", "Gold");
  const client = await createClient(db, pkg.id);

  await runCreatePackage({ role: actor.role, id: actor.id }, pkgInput({ code: "gold-pro" }), db);
  await runCreatePricingRule({ role: actor.role, id: actor.id }, await pricingRuleInput(client.id), db);
  await runSaveClientKpiConfig(actor, client.id, ["spend"], db);

  const { items } = await new SqliteAuditLogRepository(db).findByActor(actor.id, {
    limit: 100,
  });
  assert.equal(items.length, 3);
  for (const entry of items) {
    assert.equal(entry.actorUserId, actor.id);
  }

  db.close();
});

// --- 8. Target type/id ----------------------------------------------------

test("audit trail: target type and id are correct for every event type", async () => {
  const db = createTestDb();
  const actor = await createUser(db);
  const pkgA = await createPackage(db, "bronze", "Bronze");
  const pkgB = await createPackage(db, "gold", "Gold");
  const client = await createClient(db, pkgA.id);

  const created = await runCreatePackage(
    { role: actor.role, id: actor.id },
    pkgInput({ code: "platinum", name: "Platinum" }),
    db
  );
  assert.equal(created.ok, true);
  const assign = await runAssignPackage(
    { role: actor.role, id: actor.id },
    client.id,
    pkgB.id,
    { db }
  );
  assert.equal(assign.ok, true);
  const pricing = await runCreatePricingRule(
    { role: actor.role, id: actor.id },
    await pricingRuleInput(client.id),
    db
  );
  assert.equal(pricing.ok, true);
  const kpi = await runSaveClientKpiConfig(actor, client.id, ["spend"], db);
  assert.equal(kpi.ok, true);

  const pkgEntries = await findEntries(db, "package", created.ok ? created.value.id : "");
  assert.equal(pkgEntries.items.length, 1);
  assert.equal(pkgEntries.items[0].targetEntityType, "package");
  assert.equal(pkgEntries.items[0].targetEntityId, created.ok ? created.value.id : "");

  const clientEntries = await findEntries(db, "client", client.id);
  const actions = clientEntries.items.map((e) => e.action).sort();
  assert.deepEqual(
    actions,
    [
      AUDIT_ACTIONS.KPI_CONFIG_CHANGED,
      AUDIT_ACTIONS.PACKAGE_ASSIGNED,
      AUDIT_ACTIONS.PRICING_RULE_CREATED,
    ].sort()
  );
  for (const entry of clientEntries.items) {
    assert.equal(entry.targetEntityType, "client");
    assert.equal(entry.targetEntityId, client.id);
  }

  db.close();
});

// --- 9. Append-only -------------------------------------------------------

test("audit trail: audit records are append-only", async () => {
  const db = createTestDb();
  const actor = await createUser(db);
  const pkgA = await createPackage(db, "bronze", "Bronze");
  const pkgB = await createPackage(db, "gold", "Gold");
  const client = await createClient(db, pkgA.id);

  await runAssignPackage({ role: actor.role, id: actor.id }, client.id, pkgB.id, { db });
  await runSaveClientKpiConfig(actor, client.id, ["spend"], db);

  const first = await new SqliteAuditLogRepository(db).findByActor(actor.id, {
    limit: 100,
  });
  assert.equal(first.items.length, 2);
  const ids = new Set(first.items.map((e) => e.id));
  assert.equal(ids.size, 2, "every audit row has a unique id");

  const countRows = () =>
    (db.prepare("SELECT COUNT(*) AS c FROM audit_logs").get() as { c: number }).c;
  assert.equal(countRows(), 2);

  // A no-op (re-saving the same KPI set) adds no rows; existing rows survive.
  await runSaveClientKpiConfig(actor, client.id, ["spend"], db);
  assert.equal(countRows(), 2);

  const timestamps = first.items
    .map((e) => e.createdAt.getTime())
    .sort((a, b) => a - b);
  assert.ok(timestamps.every((t, i) => i === 0 || t >= timestamps[i - 1]));

  db.close();
});

// --- 10. No secrets in audit metadata -------------------------------------

test("audit trail: no raw Meta or session secrets are written", async () => {
  const db = createTestDb();
  const actor = await createUser(db);
  const pkgA = await createPackage(db, "bronze", "Bronze");
  const pkgB = await createPackage(db, "gold", "Gold");
  const client = await createClient(db, pkgA.id);

  await runCreatePackage({ role: actor.role, id: actor.id }, pkgInput({ code: "platinum", name: "Platinum" }), db);
  await runAssignPackage({ role: actor.role, id: actor.id }, client.id, pkgB.id, { db });
  await runCreatePricingRule({ role: actor.role, id: actor.id }, await pricingRuleInput(client.id), db);
  await runSaveClientKpiConfig(actor, client.id, ["spend", "cpm"], db);

  const rows = db
    .prepare("SELECT action, metadata FROM audit_logs")
    .all() as { action: string; metadata: string | null }[];
  assert.equal(rows.length, 4);

  const allowedActions: readonly string[] = Object.values(AUDIT_ACTIONS);
  const forbidden = /token|session|cookie|password|secret|rawpayload|access_token|email|snapshot/i;

  for (const row of rows) {
    assert.ok(
      allowedActions.includes(row.action),
      `unexpected audit action recorded: ${row.action}`
    );
    const meta = row.metadata ? JSON.stringify(JSON.parse(row.metadata)) : "";
    assert.ok(
      !forbidden.test(meta),
      `audit metadata must not contain secrets/snapshots: ${meta}`
    );
  }

  db.close();
});