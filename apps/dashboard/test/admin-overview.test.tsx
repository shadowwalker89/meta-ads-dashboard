import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import {
  openDatabase,
  runMigrations,
  SqliteAdAccountRepository,
  SqliteCampaignRepository,
  SqliteClientRepository,
  SqliteInsightSnapshotRepository,
  SqlitePackageRepository,
  SqliteUserRepository,
} from "@repo/database";
import type { InsightSnapshot, Package, User } from "@repo/shared";
import { getAdminOverviewData } from "@/lib/admin-overview";
import { AdminKpiCards } from "@/components/admin/admin-kpi-cards";
import { buildNavItems } from "@/lib/navigation";
import {
  DASHBOARD_STRINGS,
  getAdminKpiDescription,
  getAdminKpiTitle,
} from "@/lib/i18n/strings";

// --- Admin KPI cards: English title + Persian tooltip ----------------------

test("admin KPI card: shows the English KPI title in both languages", () => {
  const html = renderToStaticMarkup(
    <AdminKpiCards kpis={[{ key: "spend", value: 100, change: 0.25 }]} />
  );

  assert.ok(html.includes("Ad Spend"));
  // The Persian catalog label must not leak into the admin card title.
  assert.ok(!html.includes("هزینه تبلیغات"));
});

test("admin KPI card: the help button is accessible and points to the Persian description", () => {
  // Radix TooltipContent only renders while open (Presence), so static
  // markup carries the accessible aria-label/title; the Persian
  // description itself is asserted through the shared helper below and
  // verified on hover/focus/tap in the browser.
  const html = renderToStaticMarkup(
    <AdminKpiCards kpis={[{ key: "spend", value: 100, change: null }]} />
  );

  assert.ok(html.includes('aria-label="توضیح درباره‌ی Ad Spend"'));
  assert.ok(html.includes('title="توضیح درباره‌ی Ad Spend"'));
  // The tooltip content uses the shared catalog's Persian description.
  assert.equal(getAdminKpiDescription("spend"), "کل هزینه‌ی دوره");
  assert.equal(getAdminKpiTitle("spend"), "Ad Spend");
});

test("admin KPI card: formats values with the active language digits", () => {
  const html = renderToStaticMarkup(
    <AdminKpiCards kpis={[{ key: "ctr", value: 1.5, change: -0.1 }]} />
  );

  // fa default (no provider): Persian digits.
  assert.ok(html.includes("۱٫۵"));
  // Negative trend renders the down direction.
  assert.ok(html.includes('data-direction="down"'));
});

// --- Shared navigation builder ---------------------------------------------

test("navigation: a client role only sees the client dashboard item", () => {
  const items = buildNavItems("client", DASHBOARD_STRINGS.fa);
  assert.deepEqual(
    items.map((item) => item.href),
    ["/dashboard"]
  );
});

test("navigation: admin sees the admin management items, never package/pricing", () => {
  const items = buildNavItems("admin", DASHBOARD_STRINGS.fa);
  assert.deepEqual(
    items.map((item) => item.href),
    ["/dashboard", "/admin", "/admin/kpi-config", "/admin/clients"]
  );
});

test("navigation: super_admin sees every item including package/pricing", () => {
  const items = buildNavItems("super_admin", DASHBOARD_STRINGS.fa);
  assert.deepEqual(
    items.map((item) => item.href),
    [
      "/dashboard",
      "/admin",
      "/admin/kpi-config",
      "/admin/clients",
      "/admin/packages",
      "/admin/packages/assign",
      "/admin/pricing",
      "/admin/pricing/config",
    ]
  );
});

test("navigation: titles follow the language dictionary", () => {
  const en = buildNavItems("super_admin", DASHBOARD_STRINGS.en);
  assert.ok(en.some((item) => item.title === "Admin Overview"));
  const fa = buildNavItems("super_admin", DASHBOARD_STRINGS.fa);
  assert.ok(fa.some((item) => item.title === "نمای مدیریت"));
});

// --- Admin overview loader -------------------------------------------------

function createTestDb() {
  const db = openDatabase(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

async function createPackage(
  db: ReturnType<typeof openDatabase>,
  overrides: Partial<Omit<Package, "id" | "createdAt">> = {}
) {
  return new SqlitePackageRepository(db).create({
    name: "Gold",
    description: "Gold plan",
    code: "gold",
    collectionFrequency: 1,
    maxAdAccounts: null,
    maxCampaigns: null,
    retentionDays: null,
    defaultVisibleKpis: ["spend", "impressions"],
    features: { charts: true, dataExport: false, advancedReporting: false },
    pricingDefaults: {},
    metricThresholds: {},
    ...overrides,
  });
}

async function createClient(
  db: ReturnType<typeof openDatabase>,
  packageId: string,
  name: string
) {
  return new SqliteClientRepository(db).create({
    name,
    businessType: "General",
    contactEmail: `${name}@example.com`,
    packageId,
    isActive: true,
  });
}

async function createUser(
  db: ReturnType<typeof openDatabase>,
  role: User["role"],
  clientId: string | null = null
) {
  return new SqliteUserRepository(db).create({
    role,
    fullName: "Test User",
    email: `user-${role}-${Math.random().toString(36).slice(2)}@example.com`,
    clientId,
  });
}

function actor(user: { id: string; role: User["role"]; clientId: string | null }) {
  return { role: user.role, id: user.id, clientId: user.clientId };
}

function snapshot(
  campaignId: string,
  capturedAt: Date,
  overrides: Partial<Omit<InsightSnapshot, "id">> = {}
) {
  return {
    campaignId,
    capturedAt,
    impressions: 1000,
    clicks: 100,
    linkClicks: 90,
    spend: 50,
    ctr: 10,
    cpc: 0.5,
    cpm: 50,
    reach: 800,
    frequency: 1.25,
    clicksAll: 110,
    uniqueClicks: 80,
    uniqueCtr: 10,
    landingPageViews: 70,
    outboundClicks: 60,
    outboundCtr: 6,
    leads: 5,
    messagesStarted: 2,
    messagesContacts: 1,
    results: 20,
    costPerResult: 2.5,
    postReactions: 30,
    postComments: 4,
    rawPayload: null,
    ...overrides,
  };
}

test("admin overview: returns tenant-scoped clients, package and ad-account counts", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const clientA = await createClient(db, pkg.id, "Client A");
  await createClient(db, pkg.id, "Client B");
  const account = await new SqliteAdAccountRepository(db).create({
    clientId: clientA.id,
    name: "Account A",
    status: "connected",
    source: "playwright",
    metaAdAccountId: null,
  });
  await new SqliteCampaignRepository(db).create({
    adAccountId: account.id,
    name: "Campaign A",
    objective: "unknown",
    status: "unknown",
    scrapedLabel: "Campaign A",
    metaCampaignId: null,
  });
  const superUser = await createUser(db, "super_admin");

  const data = await getAdminOverviewData(actor(superUser), null, db);

  assert.equal(data.clients.length, 2);
  assert.equal(data.totalAdAccounts, 1);
  assert.equal(data.packageCount, 1);
  assert.equal(data.selectedClient, null);
  assert.equal(data.dashboard, null);

  db.close();
});

test("admin overview: a selected client yields its dashboard data and resolved KPIs", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const clientA = await createClient(db, pkg.id, "Client A");
  const account = await new SqliteAdAccountRepository(db).create({
    clientId: clientA.id,
    name: "Account A",
    status: "connected",
    source: "playwright",
    metaAdAccountId: null,
  });
  const campaign = await new SqliteCampaignRepository(db).create({
    adAccountId: account.id,
    name: "Campaign A",
    objective: "unknown",
    status: "unknown",
    scrapedLabel: "Campaign A",
    metaCampaignId: null,
  });
  await new SqliteInsightSnapshotRepository(db).append(
    snapshot(campaign.id, new Date(), { spend: 75, impressions: 500 })
  );
  const superUser = await createUser(db, "super_admin");

  const data = await getAdminOverviewData(actor(superUser), clientA.id, db);

  assert.equal(data.selectedClient?.id, clientA.id);
  assert.equal(data.dashboard?.campaignCount, 1);
  assert.equal(data.dashboard?.values.spend, 75);
  // Resolved KPI set comes from the package default (spend + impressions).
  assert.deepEqual(data.visibleKpis, ["spend", "impressions"]);

  db.close();
});

test("admin overview: an admin without access to a client is never shown that client", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const clientA = await createClient(db, pkg.id, "Client A");
  await createClient(db, pkg.id, "Client B");
  const admin = await createUser(db, "admin");

  const data = await getAdminOverviewData(actor(admin), clientA.id, db);

  // The admin is assigned to no client, so the requested id is not an
  // option; the surface must not leak it as selectable or load data.
  assert.equal(data.clients.length, 0);
  assert.equal(data.selectedClient, null);
  assert.equal(data.dashboard, null);

  db.close();
});