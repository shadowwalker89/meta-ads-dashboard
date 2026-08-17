import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  openDatabase,
  runMigrations,
  SqliteAdAccountRepository,
  SqliteAuditLogRepository,
  SqliteCampaignRepository,
  SqliteClientRepository,
  SqliteInsightSnapshotRepository,
  SqlitePackageRepository,
  SqlitePricingRuleRepository,
  SqliteUserRepository,
} from "@repo/database";
import type { InsightSnapshot, Package, PackageFeatures, User } from "@repo/shared";
import { AccessError } from "@/lib/access";
import {
  buildDashboardExportCsv,
  runGetDashboardExport,
  toCsvRow,
} from "@/lib/dashboard-export";
import { AUDIT_ACTIONS } from "@/lib/audit";
import type { ClientDashboardData } from "@/lib/client-dashboard-data";
import { zeroKpiValues } from "@/lib/client-kpis";

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
  features: PackageFeatures = { ...EMPTY_FEATURES, dataExport: true }
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

function isForbidden(error: unknown): boolean {
  return error instanceof AccessError && error.kind === "forbidden";
}

function makeEmptyDashboardData(): ClientDashboardData {
  return {
    values: zeroKpiValues(),
    campaignCount: 0,
    snapshotCount: 0,
    campaigns: [],
    period: {
      range: { from: new Date(), to: new Date() },
      previousRange: { from: new Date(), to: new Date() },
      change: {} as ClientDashboardData["period"]["change"],
    },
  };
}

// --- 1. Authorized user exports their client's data -----------------------

test("export: an authorized client exports their own client's data", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const client = await createClient(db, pkg.id, "Client One");
  const account = await createAdAccount(db, client.id, "Account A");
  const campaign = await createCampaign(db, account.id, "Campaign A");

  await new SqliteInsightSnapshotRepository(db).append(
    snapshot(campaign.id, new Date("2026-01-15T00:00:00.000Z"), {
      impressions: 1000,
      clicks: 100,
      spend: 50,
    })
  );

  const user = await createUser(db, "client", client.id);
  const { csv, filename } = await runGetDashboardExport(user, client.id, 30, db, NOW);

  // Header row: identity columns + default visible KPIs.
  assert.ok(csv.includes("نام کمپین,اکانت تبلیغاتی,زمان جمع‌آوری"));
  assert.ok(csv.includes("نمایش‌ها"));
  assert.ok(csv.includes("هزینه تبلیغات"));
  assert.ok(csv.includes("کلیک‌ها"));

  // Campaign row with priced (raw, no rule) values + as-of collection time.
  assert.ok(csv.includes("Campaign A"));
  assert.ok(csv.includes("Account A"));
  assert.ok(csv.includes("2026-01-15T00:00:00.000Z"));
  assert.ok(csv.includes("1000"));

  // Grand total row uses the displayed totals.
  const totalLine = csv.split("\r\n").find((line) => line.startsWith("جمع کل"));
  assert.ok(totalLine);
  assert.ok(totalLine.includes("1000"));
  assert.ok(totalLine.includes("100"));

  assert.match(filename, /^dashboard-export-30d-\d{4}-\d{2}-\d{2}T.*\.csv$/);

  db.close();
});

// --- 2. Unauthorized user cannot export another client's data -------------

test("export: a user cannot export another client's data", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const clientA = await createClient(db, pkg.id, "Client A");
  const clientB = await createClient(db, pkg.id, "Client B");
  const account = await createAdAccount(db, clientB.id, "Account B");
  const campaign = await createCampaign(db, account.id, "Campaign B");
  await new SqliteInsightSnapshotRepository(db).append(
    snapshot(campaign.id, new Date("2026-01-15T00:00:00.000Z"))
  );

  // Client-role user belongs to client A; exporting client B is rejected.
  const userA = await createUser(db, "client", clientA.id);
  await assert.rejects(
    () => runGetDashboardExport(userA, clientB.id, 30, db, NOW),
    isForbidden
  );

  // An admin without the assignment is equally rejected.
  const admin = await createUser(db, "admin", null);
  await assert.rejects(
    () => runGetDashboardExport(admin, clientB.id, 30, db, NOW),
    isForbidden
  );

  db.close();
});

// --- 3. dataExport=false prevents the export ------------------------------

test("export: dataExport=false blocks the export action", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, { ...EMPTY_FEATURES, dataExport: false });
  const client = await createClient(db, pkg.id, "Client One");
  const account = await createAdAccount(db, client.id, "Account A");
  const campaign = await createCampaign(db, account.id, "Campaign A");
  await new SqliteInsightSnapshotRepository(db).append(
    snapshot(campaign.id, new Date("2026-01-15T00:00:00.000Z"))
  );

  const user = await createUser(db, "client", client.id);
  await assert.rejects(
    () => runGetDashboardExport(user, client.id, 30, db, NOW),
    isForbidden
  );

  db.close();
});

// --- 4. KPI visibility is respected ---------------------------------------

test("export: only resolved visible KPIs become columns", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const client = await createClient(db, pkg.id, "Client One");
  const account = await createAdAccount(db, client.id, "Account A");
  const campaign = await createCampaign(db, account.id, "Campaign A");
  await new SqliteInsightSnapshotRepository(db).append(
    snapshot(campaign.id, new Date("2026-01-15T00:00:00.000Z"), { reach: 800, leads: 5 })
  );

  const user = await createUser(db, "client", client.id);
  const { csv } = await runGetDashboardExport(user, client.id, 30, db, NOW);

  // Default visible KPIs are present...
  assert.ok(csv.includes("نمایش‌ها"));
  assert.ok(csv.includes("هزینه تبلیغات"));
  // ...and non-visible KPIs (leads) are absent from the CSV.
  assert.ok(!csv.includes("لیدها"));
  assert.ok(!csv.includes("دسترسی"));
  assert.ok(!csv.includes("پیام‌های شروع‌شده"));

  db.close();
});

// --- 5. Pricing / customer-facing values are respected --------------------

test("export: cost metrics carry the customer (priced) value", async () => {
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
  const { csv } = await runGetDashboardExport(user, client.id, 30, db, NOW);

  // 50 + 10% = 55 appears in both the campaign row and the total row.
  const campaignLine = csv.split("\r\n").find((line) => line.includes("Campaign A"));
  assert.ok(campaignLine);
  assert.ok(campaignLine.includes("55"));
  const totalLine = csv.split("\r\n").find((line) => line.startsWith("جمع کل"));
  assert.ok(totalLine);
  assert.ok(totalLine.includes("55"));
  // Non-pricable metric stays raw.
  assert.ok(campaignLine.includes("1000"));

  db.close();
});

// --- 6. Selected 7/30/90 period is respected ------------------------------

test("export: honors the selected reporting range", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const client = await createClient(db, pkg.id, "Client One");
  const account = await createAdAccount(db, client.id, "Account A");
  const campaign = await createCampaign(db, account.id, "Campaign A");

  const snapshots = new SqliteInsightSnapshotRepository(db);
  // Jan 5 is inside a 30-day window ending Jan 20 but OUTSIDE a 7-day window.
  await snapshots.append(
    snapshot(campaign.id, new Date("2026-01-05T00:00:00.000Z"), { impressions: 500, spend: 25 })
  );

  const user = await createUser(db, "client", client.id);

  const sevenDay = await runGetDashboardExport(user, client.id, 7, db, NOW);
  assert.ok(!sevenDay.csv.includes("2026-01-05T00:00:00.000Z"));
  assert.match(sevenDay.filename, /^dashboard-export-7d-/);

  const thirtyDay = await runGetDashboardExport(user, client.id, 30, db, NOW);
  assert.ok(thirtyDay.csv.includes("2026-01-05T00:00:00.000Z"));
  assert.match(thirtyDay.filename, /^dashboard-export-30d-/);

  db.close();
});

// --- 7. No unauthorized/internal sensitive fields -------------------------

test("export: CSV exposes no internal or sensitive identifiers", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const client = await createClient(db, pkg.id, "Client One");
  const account = await createAdAccount(db, client.id, "Account A");
  const campaign = await createCampaign(db, account.id, "Campaign A");
  await new SqliteInsightSnapshotRepository(db).append(
    snapshot(campaign.id, new Date("2026-01-15T00:00:00.000Z"), {
      rawPayload: { secret: "SECRET_META_RAW" },
    })
  );

  const user = await createUser(db, "client", client.id);
  const { csv } = await runGetDashboardExport(user, client.id, 30, db, NOW);

  // Identity fields are limited to the dashboard-visible names.
  assert.ok(!csv.includes(campaign.id));
  assert.ok(!csv.includes(account.id));
  assert.ok(!csv.includes(client.id));
  assert.ok(!csv.includes(user.id));
  // Raw browser/session payload never leaks.
  assert.ok(!csv.includes("SECRET_META_RAW"));
  assert.ok(!csv.includes("rawPayload"));
  assert.ok(!csv.includes("metaCampaignId"));
  assert.ok(!csv.includes("mock-session"));
  assert.ok(!csv.includes("user@example.com"));

  db.close();
});

// --- 8. Empty client data produces a safe empty export --------------------

test("export: empty client data yields a header-only CSV", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const client = await createClient(db, pkg.id, "Client One");

  const user = await createUser(db, "client", client.id);
  const { csv } = await runGetDashboardExport(user, client.id, 30, db, NOW);

  const lines = csv.trim().split("\r\n");
  // Header only — no campaign rows, no fabricated totals.
  assert.equal(lines.length, 1);
  assert.ok(lines[0].includes("نام کمپین"));

  db.close();
});

// --- Audit -----------------------------------------------------------------

test("export: records a success-only data_export audit entry", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const client = await createClient(db, pkg.id, "Client One");
  const account = await createAdAccount(db, client.id, "Account A");
  const campaign = await createCampaign(db, account.id, "Campaign A");
  await new SqliteInsightSnapshotRepository(db).append(
    snapshot(campaign.id, new Date("2026-01-15T00:00:00.000Z"))
  );

  const user = await createUser(db, "client", client.id);
  await runGetDashboardExport(user, client.id, 30, db, NOW);

  const page = await new SqliteAuditLogRepository(db).findByTarget("client", client.id, {
    limit: 10,
  });
  const entry = page.items.find((item) => item.action === AUDIT_ACTIONS.DATA_EXPORT_CREATED);
  assert.ok(entry, "expected a data_export.created audit entry");
  assert.equal(entry.targetEntityType, "client");
  assert.equal(entry.targetEntityId, client.id);
  assert.equal(entry.actorUserId, user.id);
  assert.equal(entry.metadata?.rangeDays, 30);
  assert.equal(entry.metadata?.rowCount, 1);

  db.close();
});

test("export: a failed export records no audit entry", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, { ...EMPTY_FEATURES, dataExport: false });
  const client = await createClient(db, pkg.id, "Client One");

  const user = await createUser(db, "client", client.id);
  await assert.rejects(
    () => runGetDashboardExport(user, client.id, 30, db, NOW),
    isForbidden
  );

  const page = await new SqliteAuditLogRepository(db).findByTarget("client", client.id, {
    limit: 10,
  });
  assert.equal(
    page.items.filter((item) => item.action === AUDIT_ACTIONS.DATA_EXPORT_CREATED).length,
    0
  );

  db.close();
});

// --- Pure CSV helpers ------------------------------------------------------

test("csv: fields are escaped per RFC-4180 and rows joined with commas", () => {
  assert.equal(toCsvRow(["plain", 42]), "plain,42");
  assert.equal(toCsvRow(["with, comma"]), '"with, comma"');
  assert.equal(toCsvRow(['say "hi"']), '"say ""hi"""');
  assert.equal(toCsvRow(["line\nbreak"]), '"line\nbreak"');
});

test("csv: empty data builds a header-only CSV", () => {
  const csv = buildDashboardExportCsv(makeEmptyDashboardData(), ["spend"]);
  assert.equal(csv.trim().split("\r\n").length, 1);
  assert.ok(csv.includes("نام کمپین"));
});