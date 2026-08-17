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
  SqlitePricingRuleRepository,
  SqliteUserRepository,
} from "@repo/database";
import type { InsightSnapshot, Package, PackageFeatures, User } from "@repo/shared";
import { AccessError } from "@/lib/access";
import { getClientDashboardData } from "@/lib/client-dashboard-data";
import { getClientPackageFeatures } from "@/lib/package-features";
import { reportingRangeForDays } from "@/lib/dashboard-period";
import {
  barWidthPercent,
  buildCampaignChartRows,
  CHART_METRICS,
  resolveChartableMetrics,
} from "@/lib/campaign-chart";
import { ChartSection } from "@/components/dashboard/chart-section";
import type { ClientCampaignKpi } from "@/lib/client-kpis";

type Db = ReturnType<typeof openDatabase>;

const NOW = new Date("2026-01-20T12:00:00.000Z");

const EMPTY_FEATURES: PackageFeatures = {
  charts: false,
  dataExport: false,
  advancedReporting: false,
};

function createTestDb(): Db {
  const db = openDatabase(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

async function createPackage(
  db: Db,
  features: PackageFeatures = { ...EMPTY_FEATURES, charts: true }
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

async function createClient(
  db: Db,
  packageId: string,
  name: string
): Promise<{ id: string }> {
  return new SqliteClientRepository(db).create({
    name,
    businessType: "General",
    contactEmail: `${name}@example.com`,
    packageId,
    isActive: true,
  });
}

async function createAdAccount(
  db: Db,
  clientId: string,
  name: string
): Promise<{ id: string }> {
  return new SqliteAdAccountRepository(db).create({
    clientId,
    name,
    status: "connected",
    source: "playwright",
    metaAdAccountId: null,
  });
}

async function createCampaign(
  db: Db,
  adAccountId: string,
  name: string
): Promise<{ id: string }> {
  return new SqliteCampaignRepository(db).create({
    adAccountId,
    name,
    objective: "unknown",
    status: "unknown",
    scrapedLabel: name,
    metaCampaignId: null,
  });
}

function snapshot(
  campaignId: string,
  capturedAt: Date,
  overrides: Partial<Omit<InsightSnapshot, "id">> = {}
) {
  return {
    campaignId,
    capturedAt,
    reportingFrom: null,
    reportingTo: null,
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

async function createUser(
  db: Db,
  role: User["role"],
  clientId: string | null
): Promise<User> {
  return new SqliteUserRepository(db).create({
    role,
    fullName: "Test User",
    email: `user-${role}-${Math.random().toString(36).slice(2)}@example.com`,
    clientId,
  });
}

function makeCampaign(
  name: string,
  values: Partial<Record<keyof ClientCampaignKpi["values"], number>>
): ClientCampaignKpi {
  const all = Object.fromEntries(
    CHART_METRICS.map((m) => [m, 0])
  ) as ClientCampaignKpi["values"];
  for (const [k, v] of Object.entries(values)) {
    all[k as keyof ClientCampaignKpi["values"]] = v as number;
  }
  return {
    campaignId: `c-${name}`,
    campaignName: name,
    adAccountId: "a-1",
    adAccountName: "Account A",
    values: all,
    capturedAt: new Date("2026-01-15T00:00:00.000Z"),
  };
}

function isForbidden(error: unknown): boolean {
  return error instanceof AccessError && error.kind === "forbidden";
}

// --- 1. Charts enabled → chart data/surface available ---------------------

test("chart: charts enabled resolves the feature and the surface renders bars", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const client = await createClient(db, pkg.id, "Client One");
  const user = await createUser(db, "client", client.id);

  const features = await getClientPackageFeatures(user, client.id, db);
  assert.equal(features.charts, true);

  const html = renderToStaticMarkup(
    <ChartSection
      campaigns={[
        makeCampaign("Campaign A", { spend: 100, impressions: 2000 }),
        makeCampaign("Campaign B", { spend: 50, impressions: 1000 }),
      ]}
      availableMetrics={["spend", "impressions"]}
      period={30}
    />
  );
  assert.ok(html.includes("مقایسه‌ی کمپین‌ها"));
  assert.ok(html.includes("Campaign A"));
  assert.ok(html.includes("Campaign B"));

  db.close();
});

// --- 2. Charts disabled → surface absent ----------------------------------

test("chart: charts disabled resolves false so the page never mounts the surface", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, { ...EMPTY_FEATURES, charts: false });
  const client = await createClient(db, pkg.id, "Client One");
  const user = await createUser(db, "client", client.id);

  const features = await getClientPackageFeatures(user, client.id, db);
  assert.equal(features.charts, false);

  db.close();
});

// --- 3. Unauthorized client → no chart data -------------------------------

test("chart: the chart data read rejects an unauthorized user", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const clientA = await createClient(db, pkg.id, "Client A");
  const clientB = await createClient(db, pkg.id, "Client B");
  const account = await createAdAccount(db, clientB.id, "Account B");
  const campaign = await createCampaign(db, account.id, "Campaign B");
  await new SqliteInsightSnapshotRepository(db).append(
    snapshot(campaign.id, new Date("2026-01-15T00:00:00.000Z"))
  );

  const userA = await createUser(db, "client", clientA.id);
  await assert.rejects(
    () => getClientDashboardData(userA, clientB.id, db, reportingRangeForDays(30, NOW)),
    isForbidden
  );

  db.close();
});

// --- 4. KPI visibility respected ------------------------------------------

test("chart: only KPIs the client may see become chart metrics", () => {
  assert.deepEqual(
    resolveChartableMetrics(["spend", "impressions", "ctr", "cpm"]),
    ["spend", "impressions"]
  );
  assert.deepEqual(resolveChartableMetrics(["ctr", "reach"]), []);
  assert.deepEqual(resolveChartableMetrics(CHART_METRICS), [...CHART_METRICS]);
});

// --- 5. Selected reporting range respected --------------------------------

test("chart: rows reflect the selected 7/30/90 reporting window", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const client = await createClient(db, pkg.id, "Client One");
  const account = await createAdAccount(db, client.id, "Account A");
  const campaign = await createCampaign(db, account.id, "Campaign A");

  // Captured Jan 5: inside a 30-day window ending Jan 20, outside a 7-day one.
  await new SqliteInsightSnapshotRepository(db).append(
    snapshot(campaign.id, new Date("2026-01-05T00:00:00.000Z"), { impressions: 500, spend: 25 })
  );

  const user = await createUser(db, "client", client.id);

  const sevenDay = await getClientDashboardData(
    user,
    client.id,
    db,
    reportingRangeForDays(7, NOW)
  );
  assert.equal(buildCampaignChartRows(sevenDay.campaigns, "spend").length, 0);

  const thirtyDay = await getClientDashboardData(
    user,
    client.id,
    db,
    reportingRangeForDays(30, NOW)
  );
  const rows = buildCampaignChartRows(thirtyDay.campaigns, "spend");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].label, "Campaign A");
  assert.equal(rows[0].value, 25);

  db.close();
});

// --- 6. Customer pricing respected ----------------------------------------

test("chart: cost metrics carry the customer (priced) value", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const client = await createClient(db, pkg.id, "Client One");
  const account = await createAdAccount(db, client.id, "Account A");
  const campaign = await createCampaign(db, account.id, "Campaign A");
  await new SqliteInsightSnapshotRepository(db).append(
    snapshot(campaign.id, new Date("2026-01-15T00:00:00.000Z"), { spend: 50, impressions: 1000 })
  );

  await new SqlitePricingRuleRepository(db).create({
    clientId: client.id,
    metric: "spend",
    percentageMarkup: 0.1,
    fixedMarkup: null,
    minimumCustomerValue: null,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
  });

  const user = await createUser(db, "client", client.id);
  const data = await getClientDashboardData(user, client.id, db, reportingRangeForDays(30, NOW));

  const spendRows = buildCampaignChartRows(data.campaigns, "spend");
  assert.equal(spendRows.length, 1);
  // 50 + 10% = 55, the customer-facing value the dashboard displays.
  assert.equal(spendRows[0].value, 55);
  // Non-pricable metric stays raw.
  const impressionRows = buildCampaignChartRows(data.campaigns, "impressions");
  assert.equal(impressionRows[0].value, 1000);

  db.close();
});

// --- 7. Empty campaign data handled safely --------------------------------

test("chart: empty campaign data produces no rows and a safe empty state", () => {
  assert.deepEqual(buildCampaignChartRows([], "spend"), []);

  const html = renderToStaticMarkup(
    <ChartSection campaigns={[]} availableMetrics={["spend"]} period={30} />
  );
  assert.ok(html.includes("هنوز داده‌ای برای این بازه ثبت نشده است."));
  assert.ok(!html.includes("data-slot=\"chart-bars\""));
});

test("chart: bar widths never produce NaN/Infinity on empty or zero datasets", () => {
  assert.equal(barWidthPercent(0, 0), 0);
  assert.equal(barWidthPercent(50, 0), 0);
  assert.equal(barWidthPercent(50, 100), 50);
  assert.equal(barWidthPercent(-5, 100), 0);
  assert.equal(barWidthPercent(120, 100), 100);
});

// --- 8. Labels describe as-of / current-period semantics ------------------

test("chart: labels describe campaign comparison, never a daily trend", () => {
  const html = renderToStaticMarkup(
    <ChartSection
      campaigns={[makeCampaign("Campaign A", { spend: 100 })]}
      availableMetrics={["spend"]}
      period={7}
    />
  );

  assert.ok(html.includes("مقایسه‌ی کمپین‌ها"));
  assert.ok(html.includes("مقادیر تجمعی دوره، نه فعالیت روزانه"));
  assert.ok(html.includes("هزینه تبلیغات"));
  // No time-series / daily-trend wording.
  assert.ok(!html.includes("روند روزانه"));
  assert.ok(!html.includes("نمودار زمانی"));
  assert.ok(!html.includes("روند روز"));
});

// --- Pure helpers: sorting + selector -------------------------------------

test("chart: rows are sorted descending so the top campaigns appear first", () => {
  const rows = buildCampaignChartRows(
    [
      makeCampaign("Low", { spend: 10 }),
      makeCampaign("High", { spend: 200 }),
      makeCampaign("Mid", { spend: 50 }),
    ],
    "spend"
  );
  assert.deepEqual(
    rows.map((row) => row.label),
    ["High", "Mid", "Low"]
  );
});

test("chart: the metric selector renders only the granted metrics", () => {
  const html = renderToStaticMarkup(
    <ChartSection
      campaigns={[makeCampaign("Campaign A", { spend: 1, impressions: 2 })]}
      availableMetrics={["spend"]}
      period={30}
    />
  );
  assert.ok(html.includes("هزینه تبلیغات"));
  // impressions/clicks/linkClicks were not granted to this client.
  assert.ok(!html.includes("نمایش‌ها"));
  assert.ok(!html.includes("کلیک‌ها"));
  assert.ok(!html.includes("کلیک روی لینک"));
});