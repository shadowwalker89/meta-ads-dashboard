import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import {
  openDatabase,
  runMigrations,
  PackageAssignmentService,
  SqliteClientRepository,
  SqlitePackageRepository,
  SqliteUserRepository,
} from "@repo/database";
import type { AssignPackageInput } from "@repo/database";
import type { Package, UserRole } from "@repo/shared";
import { canUserConfigureClientKpis } from "@repo/shared";
import {
  canManagePackages,
  assertCanManagePackages,
  getClientAssignmentData,
  getPackageManagementData,
  runAssignPackage,
  runCreatePackage,
  runUpdatePackage,
  toPackageSettingsInput,
} from "@/lib/package-admin";
import { PackageList } from "@/components/admin/package-list";
import { PackageSettingsPreview } from "@/components/admin/package-settings-preview";
import { PackageAssignmentPanel } from "@/components/admin/package-assignment-panel";
import { formatRuleComponents } from "@/lib/pricing-format";

function createTestDb() {
  const db = openDatabase(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

async function createPackage(
  db: ReturnType<typeof openDatabase>,
  code: string,
  name: string,
  overrides: Partial<Omit<Package, "id" | "createdAt">> = {}
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
    ...overrides,
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

async function createUser(db: ReturnType<typeof openDatabase>) {
  return new SqliteUserRepository(db).create({
    role: "super_admin",
    fullName: "Test Admin",
    email: `admin-${Math.random().toString(36).slice(2)}@example.com`,
    clientId: null,
  });
}

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
    features: { charts: true, dataExport: false, advancedReporting: true },
    pricingDefaults: {
      cpm: { percentageMarkup: null, fixedMarkup: 1.0, minimumCustomerValue: null },
      cpc: { percentageMarkup: 0.4, fixedMarkup: null, minimumCustomerValue: null },
    },
    metricThresholds: {},
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// --- 1-3. Authorization ---------------------------------------------------

test("package admin: only super_admin can manage packages", () => {
  assert.equal(canManagePackages({ role: "super_admin" }), true);
  assert.equal(canManagePackages({ role: "admin" }), false);
  assert.equal(canManagePackages({ role: "client" }), false);
  assert.equal(canManagePackages(null), false);
});

test("package admin: the throwing gate rejects admin and client, allows super_admin", () => {
  assert.throws(() => assertCanManagePackages({ role: "admin" }), /فقط مدیر کل/);
  assert.throws(() => assertCanManagePackages({ role: "client" }), /فقط مدیر کل/);
  assert.doesNotThrow(() => assertCanManagePackages({ role: "super_admin" }));
});

// --- 4. Package list renders DB packages ---------------------------------

test("package admin: the package list renders packages from the database", async () => {
  const db = createTestDb();
  await createPackage(db, "gold", "Gold", { collectionFrequency: 12 });
  await createPackage(db, "bronze", "Bronze");

  const packages = await getPackageManagementData(db);
  assert.equal(packages.length, 2);

  const html = renderToStaticMarkup(
    <PackageList packages={packages} onCreate={() => {}} onEdit={() => {}} />
  );
  assert.ok(html.includes("Gold"));
  assert.ok(html.includes("Bronze"));
  assert.ok(html.includes("gold"));
  assert.ok(html.includes("bronze"));

  db.close();
});

// --- 5. Package settings render ------------------------------------------

test("package admin: package settings render correctly", () => {
  const html = renderToStaticMarkup(<PackageSettingsPreview pkg={makePackage()} />);

  assert.ok(html.includes("Gold"));
  assert.ok(html.includes("gold"));
  assert.ok(html.includes("12"));
  assert.ok(html.includes("5"));
  assert.ok(html.includes("50"));
  assert.ok(html.includes("90"));
  // KPI default labels (English admin titles).
  assert.ok(html.includes("Ad Spend"));
  assert.ok(html.includes("Impressions"));
  assert.ok(html.includes("Click-Through Rate (CTR)"));
  // Feature flags.
  assert.ok(html.includes("نمودار"));
  assert.ok(html.includes("گزارش پیشرفته"));
  assert.ok(!html.includes("خروجی داده"));
});

// --- 6. Assignment UI shows current package ------------------------------

test("package admin: the assignment UI shows the client's current package", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold");
  const client = await createClient(db, pkg.id, "Client One");

  const { clients } = await getClientAssignmentData(db);
  const entry = clients.find((c) => c.id === client.id);
  assert.equal(entry?.packageName, "Gold");
  assert.ok(entry?.packageAssignedAt instanceof Date);

  const html = renderToStaticMarkup(
    <PackageAssignmentPanel
      clients={clients}
      packages={await getPackageManagementData(db)}
      selectedClientId={client.id}
      selectedPackageId={null}
      busy={false}
      success={null}
      error={null}
      onClientChange={() => {}}
      onPackageChange={() => {}}
      onAssign={() => {}}
    />
  );
  assert.ok(html.includes("پکیج فعلی"));
  assert.ok(html.includes("Gold"));
  assert.ok(html.includes("زمان انتساب"));

  db.close();
});

// --- 7. Assignment action uses PackageAssignmentService ------------------

test("package admin: the assignment action delegates to PackageAssignmentService", async () => {
  const db = createTestDb();
  const pkgA = await createPackage(db, "bronze", "Bronze");
  const pkgB = await createPackage(db, "gold", "Gold", {
    pricingDefaults: {
      cpm: { percentageMarkup: null, fixedMarkup: 1.0, minimumCustomerValue: null },
    },
  });
  const client = await createClient(db, pkgA.id);

  const service = new PackageAssignmentService(db);
  const calls: AssignPackageInput[] = [];
  const spy = {
    async assignPackage(input: AssignPackageInput) {
      calls.push(input);
      return service.assignPackage(input);
    },
  };

  const actor = await createUser(db);
  const outcome = await runAssignPackage(
    { role: actor.role, id: actor.id },
    client.id,
    pkgB.id,
    { db, assignmentService: spy }
  );

  assert.equal(outcome.ok, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    actorRole: "super_admin",
    clientId: client.id,
    packageId: pkgB.id,
  });
  if (outcome.ok) {
    assert.equal(outcome.value.packageId, pkgB.id);
    assert.equal(outcome.value.changed, true);
    assert.equal(outcome.value.pricingRulesCreated, 1);
  }

  db.close();
});

// --- 8. Admin/client cannot assign ---------------------------------------

test("package admin: admin and client cannot assign packages", async () => {
  const db = createTestDb();
  const pkgA = await createPackage(db, "bronze", "Bronze");
  const pkgB = await createPackage(db, "gold", "Gold");
  const client = await createClient(db, pkgA.id);

  let calls = 0;
  const spy = {
    async assignPackage() {
      calls += 1;
      throw new Error("must not run");
    },
  };

  const roles: UserRole[] = ["admin", "client"];
  for (const role of roles) {
    const outcome = await runAssignPackage({ role, id: "no-such-user" }, client.id, pkgB.id, {
      db,
      assignmentService: spy,
    });
    assert.equal(outcome.ok, false);
    assert.ok(outcome.error.includes("فقط مدیر کل"));
  }
  assert.equal(calls, 0, "the service must never be called for non-super-admin");

  const reloaded = await new SqliteClientRepository(db).findById(client.id);
  assert.equal(reloaded?.packageId, pkgA.id);

  db.close();
});

// --- 9. Same-package idempotency -----------------------------------------

test("package admin: same-package assignment stays idempotent through the action", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold", {
    pricingDefaults: {
      cpm: { percentageMarkup: null, fixedMarkup: 1.0, minimumCustomerValue: null },
    },
  });
  const client = await createClient(db, pkg.id);
  const actor = await createUser(db);

  const first = await runAssignPackage({ role: actor.role, id: actor.id }, client.id, pkg.id, { db });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.value.changed, false);
  assert.equal(first.value.pricingRulesCreated, 1);
  const assignedAt = first.value.packageAssignedAt.getTime();

  const second = await runAssignPackage({ role: actor.role, id: actor.id }, client.id, pkg.id, { db });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.value.changed, false);
  assert.equal(second.value.pricingRulesCreated, 0);
  assert.equal(second.value.packageAssignedAt.getTime(), assignedAt);

  db.close();
});

// --- 10. Package preview shows pricing defaults ---------------------------

test("package admin: the package preview shows pricing defaults", () => {
  const html = renderToStaticMarkup(<PackageSettingsPreview pkg={makePackage()} />);

  assert.ok(html.includes("پیش‌فرض قیمت‌گذاری"));
  assert.ok(html.includes("Cost per 1K Impressions (CPM)"));
  assert.ok(html.includes("Cost per Click (CPC)"));

  const cpmChips = formatRuleComponents({
    percentageMarkup: null,
    fixedMarkup: 1.0,
    minimumCustomerValue: null,
  });
  for (const chip of cpmChips) {
    assert.ok(html.includes(chip), `expected ${chip} in preview`);
  }
});

// --- 11. No hard-coded tier assumptions ----------------------------------

test("package admin: a custom tier code renders data-driven (no hard-coded tiers)", async () => {
  const db = createTestDb();
  await createPackage(db, "custom-tier", "Custom Tier", {
    pricingDefaults: {
      cpm: { percentageMarkup: null, fixedMarkup: 1.0, minimumCustomerValue: null },
    },
  });

  const packages = await getPackageManagementData(db);
  const html = renderToStaticMarkup(
    <PackageList packages={packages} onCreate={() => {}} onEdit={() => {}} />
  );
  assert.ok(html.includes("custom-tier"));
  assert.ok(html.includes("Custom Tier"));
  assert.ok(html.includes("Cost per 1K Impressions (CPM)"));

  db.close();
});

test("package admin: package source files never hard-code Bronze/Silver/Gold", () => {
  const files = [
    "lib/package-admin.ts",
    "components/admin/package-list.tsx",
    "components/admin/package-form.tsx",
    "components/admin/package-management.tsx",
    "components/admin/package-settings-preview.tsx",
    "components/admin/package-assignment-panel.tsx",
    "components/admin/package-assignment-workflow.tsx",
    "app/(dashboard)/admin/packages/actions.ts",
  ];
  const cwd = process.cwd();
  for (const rel of files) {
    const source = readFileSync(join(cwd, rel), "utf8");
    assert.ok(
      !/bronze|silver|gold/i.test(source),
      `${rel} must not hard-code tier names`
    );
  }
});

// --- 12. Existing KPI configuration unaffected ----------------------------

test("package admin: existing KPI configuration authorization is unchanged", () => {
  // The shared KPI rule still governs: super_admin may configure anyone,
  // a normal admin only their assigned clients, a client never.
  assert.equal(canUserConfigureClientKpis({ role: "super_admin" }, "c1", []), true);
  assert.equal(canUserConfigureClientKpis({ role: "admin" }, "c1", ["c1"]), true);
  assert.equal(canUserConfigureClientKpis({ role: "admin" }, "c1", []), false);
  assert.equal(canUserConfigureClientKpis({ role: "client" }, "c1", ["c1"]), false);
});

// --- Package CRUD (create/edit) ------------------------------------------

test("package admin: super admin can create and update a package through the action runners", async () => {
  const db = createTestDb();
  const actor = await createUser(db);

  const created = await runCreatePackage(
    { role: actor.role, id: actor.id },
    toPackageSettingsInput(makePackage({ code: "newtier", name: "New Tier" })),
    db
  );
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(created.value.code, "newtier");

  const updated = await runUpdatePackage(
    { role: actor.role, id: actor.id },
    created.value.id,
    toPackageSettingsInput(
      makePackage({ code: "newtier", name: "New Tier", collectionFrequency: 6 })
    ),
    db
  );
  assert.equal(updated.ok, true);
  if (!updated.ok) return;
  assert.equal(updated.value.collectionFrequency, 6);
  assert.equal(updated.value.code, "newtier");

  db.close();
});