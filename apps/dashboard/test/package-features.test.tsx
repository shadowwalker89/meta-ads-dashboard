import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import {
  openDatabase,
  runMigrations,
  SqliteAdminAssignmentRepository,
  SqliteClientRepository,
  SqlitePackageRepository,
  SqliteUserRepository,
} from "@repo/database";
import type { Package, UserRole } from "@repo/shared";
import { getClientPackageFeatures } from "@/lib/package-features";
import { AccessError } from "@/lib/access";
import { ChartSection } from "@/components/dashboard/chart-section";
import { AdvancedReportingSection } from "@/components/dashboard/advanced-reporting-section";
import { DataExportButton } from "@/components/dashboard/data-export-button";

type Db = ReturnType<typeof openDatabase>;

function createTestDb(): Db {
  const db = openDatabase(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

async function createPackage(
  db: Db,
  features: { charts: boolean; dataExport: boolean; advancedReporting: boolean }
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
    features,
    pricingDefaults: {},
    metricThresholds: {},
  });
}

async function createClient(db: Db, packageId: string, name = "Client One"): Promise<{ id: string }> {
  return new SqliteClientRepository(db).create({
    name,
    businessType: "General",
    contactEmail: "client@example.com",
    packageId,
    isActive: true,
  });
}

async function createUser(
  db: Db,
  role: UserRole,
  clientId: string | null = null
) {
  return new SqliteUserRepository(db).create({
    role,
    fullName: "Test User",
    email: `user-${role}-${Math.random().toString(36).slice(2)}@example.com`,
    clientId,
  });
}

function actor(user: { id: string; role: UserRole; clientId: string | null }) {
  return { role: user.role, id: user.id, clientId: user.clientId };
}

// --- 1. Enabled flag → feature available ----------------------------------

test("package features: enabled flags resolve from the client's package", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, {
    charts: true,
    dataExport: true,
    advancedReporting: false,
  });
  const client = await createClient(db, pkg.id);
  const user = await createUser(db, "client", client.id);

  const features = await getClientPackageFeatures(actor(user), client.id, db);
  assert.deepEqual(features, {
    charts: true,
    dataExport: true,
    advancedReporting: false,
  });

  db.close();
});

// --- 2. Disabled flag → feature hidden ------------------------------------

test("package features: disabled flags resolve as false", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, {
    charts: false,
    dataExport: false,
    advancedReporting: false,
  });
  const client = await createClient(db, pkg.id);
  const user = await createUser(db, "client", client.id);

  const features = await getClientPackageFeatures(actor(user), client.id, db);
  assert.deepEqual(features, {
    charts: false,
    dataExport: false,
    advancedReporting: false,
  });

  db.close();
});

// --- 3. Unauthorized client → rejected ------------------------------------

test("package features: a client role cannot read another client's features", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, {
    charts: true,
    dataExport: true,
    advancedReporting: true,
  });
  const owner = await createClient(db, pkg.id, "Owner");
  const other = await createClient(db, pkg.id, "Other");
  const user = await createUser(db, "client", owner.id);

  await assert.rejects(
    () => getClientPackageFeatures(actor(user), other.id, db),
    (error: unknown) => error instanceof AccessError && error.kind === "forbidden"
  );

  db.close();
});

// --- 4. Admin scope honored ------------------------------------------------

test("package features: admin reads features only for assigned clients", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, {
    charts: true,
    dataExport: false,
    advancedReporting: false,
  });
  const assigned = await createClient(db, pkg.id, "Assigned");
  const unassigned = await createClient(db, pkg.id, "Unassigned");
  const admin = await createUser(db, "admin");
  await new SqliteAdminAssignmentRepository(db).assign(admin.id, assigned.id);

  const features = await getClientPackageFeatures(actor(admin), assigned.id, db);
  assert.equal(features.charts, true);

  await assert.rejects(
    () => getClientPackageFeatures(actor(admin), unassigned.id, db),
    (error: unknown) => error instanceof AccessError && error.kind === "forbidden"
  );

  db.close();
});

// --- 5. Server-side only, never from request input ------------------------

test("package features: features come from the package row, never from input", async () => {
  const db = createTestDb();
  const limitedPkg = await createPackage(db, {
    charts: false,
    dataExport: false,
    advancedReporting: false,
  });
  const client = await createClient(db, limitedPkg.id);
  const user = await createUser(db, "client", client.id);

  // The client cannot opt into features by requesting them — the resolver
  // only ever reads the stored package. There is no client-provided flag
  // to pass, and even a super_admin reading an unprivileged package sees
  // its stored (false) entitlements.
  const features = await getClientPackageFeatures(actor(user), client.id, db);
  assert.equal(features.charts, false);
  assert.equal(features.dataExport, false);

  db.close();
});

// --- 6. Super admin may read any client's features ------------------------

test("package features: super_admin reads any client's features", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, {
    charts: true,
    dataExport: true,
    advancedReporting: true,
  });
  const client = await createClient(db, pkg.id);
  const superUser = await createUser(db, "super_admin");

  const features = await getClientPackageFeatures(actor(superUser), client.id, db);
  assert.deepEqual(features, {
    charts: true,
    dataExport: true,
    advancedReporting: true,
  });

  db.close();
});

// --- 7. Gated surfaces render their markup when mounted -------------------
// The page mounts these only when the corresponding flag is true
// (server-side gating in the dashboard page). These render tests pin the
// surfaces that become "visible"; the absence of a surface under a false
// flag is guaranteed by the resolver tests above plus the page's pure
// conditional (`features?.charts ? <ChartSection /> : null`).

test("package features: chart and advanced-reporting surfaces render their sections", () => {
  const chartHtml = renderToStaticMarkup(<ChartSection />);
  assert.ok(chartHtml.includes("نمودارها"));
  assert.ok(chartHtml.includes("data-slot=\"feature-section\""));

  const advancedHtml = renderToStaticMarkup(<AdvancedReportingSection />);
  assert.ok(advancedHtml.includes("گزارش پیشرفته"));
  assert.ok(advancedHtml.includes("data-slot=\"feature-section\""));
});

test("package features: data-export button renders its entry point", () => {
  const html = renderToStaticMarkup(<DataExportButton period={30} />);
  assert.ok(html.includes("خروجی داده"));
  // The download/loading states only appear after interaction — the
  // static render must NOT show a busy state.
  assert.ok(!html.includes("در حال تهیه‌ی خروجی"));
});