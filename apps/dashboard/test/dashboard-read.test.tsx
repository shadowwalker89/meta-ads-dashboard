import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  openDatabase,
  runMigrations,
  SqliteAdAccountRepository,
  SqliteCampaignRepository,
  SqliteClientRepository,
  SqliteInsightSnapshotRepository,
  SqlitePackageRepository,
  SqlitePricingRuleRepository,
} from "@repo/database";
import type { InsightSnapshot, Package, User } from "@repo/shared";
import {
  defaultDashboardRange,
  getClientDashboardData,
  type DashboardRange,
} from "@/lib/client-dashboard-data";
import { AccessError } from "@/lib/access";
import { previousPeriod, reportingRangeForDays } from "@/lib/dashboard-period";

type Db = ReturnType<typeof openDatabase>;

const RANGE: DashboardRange = {
  from: new Date("2026-01-10T00:00:00.000Z"),
  to: new Date("2026-01-20T00:00:00.000Z"),
};

function createTestDb(): Db {
  const db = openDatabase(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

async function createPackage(db: Db): Promise<Package> {
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

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "u-1",
    role: "client",
    fullName: "User",
    email: "user@example.com",
    clientId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function isForbidden(error: unknown): boolean {
  return error instanceof AccessError && error.kind === "forbidden";
}

test("dashboard read: aggregates the latest snapshot of each campaign and never sums snapshots of the same campaign", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const client = await createClient(db, pkg.id, "Client One");
  const account = await createAdAccount(db, client.id, "Account A");
  const campaignA = await createCampaign(db, account.id, "Campaign A");
  const campaignB = await createCampaign(db, account.id, "Campaign B");

  const snapshots = new SqliteInsightSnapshotRepository(db);
  await snapshots.append(snapshot(campaignA.id, new Date("2026-01-12T00:00:00.000Z"), { impressions: 500, clicks: 50, spend: 25, reach: 400, results: 10 }));
  await snapshots.append(snapshot(campaignA.id, new Date("2026-01-15T00:00:00.000Z"), { impressions: 1000, clicks: 100, spend: 50, reach: 800, results: 20 }));
  await snapshots.append(snapshot(campaignB.id, new Date("2026-01-15T00:00:00.000Z"), { impressions: 2000, clicks: 300, spend: 150, reach: 1200, results: 30 }));

  const user = makeUser({ id: "cu", clientId: client.id });
  const data = await getClientDashboardData(user, client.id, db, RANGE);

  // Only the LATEST snapshot of campaign A (t=Jan15) is summed — the
  // older Jan12 snapshot is never added. Both campaigns contribute once.
  assert.equal(data.snapshotCount, 2);
  assert.equal(data.campaignCount, 2);
  assert.equal(data.values.impressions, 1000 + 2000);
  assert.equal(data.values.clicks, 100 + 300);
  assert.equal(data.values.linkClicks, 90 + 90);
  assert.equal(data.values.spend, 50 + 150);
  assert.equal(data.values.reach, 800 + 1200);
  assert.equal(data.campaigns.length, 2);

  db.close();
});

test("dashboard read: honors the date range boundaries", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const client = await createClient(db, pkg.id, "Client One");
  const account = await createAdAccount(db, client.id, "Account A");
  const campaign = await createCampaign(db, account.id, "Campaign A");

  const snapshots = new SqliteInsightSnapshotRepository(db);
  await snapshots.append(snapshot(campaign.id, new Date("2026-01-05T00:00:00.000Z"), { impressions: 111 }));
  await snapshots.append(snapshot(campaign.id, new Date("2026-01-15T00:00:00.000Z"), { impressions: 222 }));
  await snapshots.append(snapshot(campaign.id, new Date("2026-01-25T00:00:00.000Z"), { impressions: 333 }));

  const user = makeUser({ id: "cu", clientId: client.id });
  const data = await getClientDashboardData(user, client.id, db, RANGE);

  // Only the snapshot captured inside [Jan10, Jan20] contributes.
  assert.equal(data.snapshotCount, 1);
  assert.equal(data.values.impressions, 222);
  assert.equal(data.campaigns[0].capturedAt.toISOString(), "2026-01-15T00:00:00.000Z");

  db.close();
});

test("dashboard read: derives rates from the aggregated raw metrics", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const client = await createClient(db, pkg.id, "Client One");
  const account = await createAdAccount(db, client.id, "Account A");
  const campaign = await createCampaign(db, account.id, "Campaign A");

  const snapshots = new SqliteInsightSnapshotRepository(db);
  await snapshots.append(
    snapshot(campaign.id, new Date("2026-01-15T00:00:00.000Z"), {
      impressions: 1000,
      clicks: 100,
      reach: 800,
      spend: 50,
      results: 20,
      uniqueClicks: 80,
    })
  );

  const user = makeUser({ id: "cu", clientId: client.id });
  const data = await getClientDashboardData(user, client.id, db, RANGE);

  assert.equal(data.values.ctr, 10); // clicks/impressions*100
  assert.equal(data.values.cpc, 0.5); // spend/clicks
  assert.equal(data.values.cpm, 50); // spend*1000/impressions
  assert.equal(data.values.costPerResult, 2.5); // spend/results
  assert.equal(data.values.frequency, 1.25); // impressions/reach

  db.close();
});

test("dashboard read: empty client returns a stable zeroed result", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const client = await createClient(db, pkg.id, "Client One");
  const user = makeUser({ id: "cu", clientId: client.id });

  const data = await getClientDashboardData(user, client.id, db, RANGE);
  assert.equal(data.snapshotCount, 0);
  assert.equal(data.campaignCount, 0);
  assert.equal(data.campaigns.length, 0);
  assert.equal(data.values.impressions, 0);
  assert.equal(data.values.spend, 0);
  assert.equal(data.values.ctr, 0);
  assert.equal(data.values.cpc, 0);

  // A client with campaigns but no snapshots in range behaves the same.
  const account = await createAdAccount(db, client.id, "Account A");
  await createCampaign(db, account.id, "Campaign A");
  const withCampaigns = await getClientDashboardData(user, client.id, db, RANGE);
  assert.equal(withCampaigns.snapshotCount, 0);
  assert.equal(withCampaigns.campaignCount, 0);
  assert.equal(withCampaigns.values.spend, 0);

  db.close();
});

test("dashboard read: tenant isolation — a client cannot read another client's data", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const clientA = await createClient(db, pkg.id, "Client A");
  const clientB = await createClient(db, pkg.id, "Client B");
  const account = await createAdAccount(db, clientB.id, "Account B");
  const campaign = await createCampaign(db, account.id, "Campaign B");
  await new SqliteInsightSnapshotRepository(db).append(
    snapshot(campaign.id, new Date("2026-01-15T00:00:00.000Z"))
  );

  const userA = makeUser({ id: "cu", clientId: clientA.id });
  await assert.rejects(
    () => getClientDashboardData(userA, clientB.id, db, RANGE),
    isForbidden
  );

  // super_admin is not blocked.
  const superUser = makeUser({ id: "sa", role: "super_admin" });
  const data = await getClientDashboardData(superUser, clientB.id, db, RANGE);
  assert.equal(data.snapshotCount, 1);

  db.close();
});

test("dashboard read: applies the pricing layer to totals and per-campaign rows", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const client = await createClient(db, pkg.id, "Client One");
  const account = await createAdAccount(db, client.id, "Account A");
  const campaign = await createCampaign(db, account.id, "Campaign A");

  const snapshots = new SqliteInsightSnapshotRepository(db);
  await snapshots.append(
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

  const user = makeUser({ id: "cu", clientId: client.id });
  const data = await getClientDashboardData(user, client.id, db, RANGE);

  // 50 + 10% = 55 (within floating-point tolerance), applied to both
  // the total and the campaign row.
  assert.ok(Math.abs(data.values.spend - 55) < 1e-9);
  assert.ok(Math.abs(data.campaigns[0].values.spend - 55) < 1e-9);
  // Non-pricable metrics stay raw.
  assert.equal(data.values.impressions, 1000);

  db.close();
});

test("dashboard read: defaultDashboardRange spans the trailing 30 days", () => {
  const now = new Date("2026-08-15T12:00:00.000Z");
  const range = defaultDashboardRange(now);
  assert.equal(range.to, now);
  assert.equal(
    range.from.toISOString(),
    new Date("2026-07-16T12:00:00.000Z").toISOString()
  );
});

test("dashboard read: period exposes the current and previous windows", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const client = await createClient(db, pkg.id, "Client One");
  const account = await createAdAccount(db, client.id, "Account A");
  const campaign = await createCampaign(db, account.id, "Campaign A");
  await new SqliteInsightSnapshotRepository(db).append(
    snapshot(campaign.id, new Date("2026-01-15T00:00:00.000Z"))
  );

  const user = makeUser({ id: "cu", clientId: client.id });
  const data = await getClientDashboardData(user, client.id, db, RANGE);

  assert.deepEqual(data.period.range, RANGE);
  assert.deepEqual(data.period.previousRange, previousPeriod(RANGE));

  db.close();
});

test("dashboard read: previous-period comparison computes the correct percentage change", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const client = await createClient(db, pkg.id, "Client One");
  const account = await createAdAccount(db, client.id, "Account A");
  const campaign = await createCampaign(db, account.id, "Campaign A");

  const snapshots = new SqliteInsightSnapshotRepository(db);
  // Previous window: latest snapshot captured inside [Dec30 23:59:59.999, Jan9 23:59:59.999].
  await snapshots.append(snapshot(campaign.id, new Date("2026-01-05T00:00:00.000Z"), { spend: 100, impressions: 1000, clicks: 100, reach: 900, results: 20 }));
  // Current window: latest snapshot captured inside [Jan10, Jan20].
  await snapshots.append(snapshot(campaign.id, new Date("2026-01-15T00:00:00.000Z"), { spend: 150, impressions: 2000, clicks: 150, reach: 1600, results: 30 }));

  const user = makeUser({ id: "cu", clientId: client.id });
  const data = await getClientDashboardData(user, client.id, db, RANGE);

  assert.equal(data.period.change.spend, 50); // (150-100)/100*100
  assert.equal(data.period.change.impressions, 100); // (2000-1000)/1000*100
  assert.ok(Math.abs(data.period.change.reach! - (700 / 900) * 100) < 1e-9);
  // CTR is a rate and can legitimately fall: 7.5 vs 10 → -25%.
  assert.ok(Math.abs(data.period.change.ctr! - (-25)) < 1e-9);

  db.close();
});

test("dashboard read: a count/spend decrease between readings is flagged as untrustworthy (rolling-window guard)", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const client = await createClient(db, pkg.id, "Client One");
  const account = await createAdAccount(db, client.id, "Account A");
  const campaign = await createCampaign(db, account.id, "Campaign A");

  const snapshots = new SqliteInsightSnapshotRepository(db);
  await snapshots.append(snapshot(campaign.id, new Date("2026-01-05T00:00:00.000Z"), { spend: 200, impressions: 2000, clicks: 100, reach: 1500 }));
  // Current readings are LOWER on spend/impressions/reach — under
  // cumulative semantics this can only be a window-roll artifact.
  await snapshots.append(snapshot(campaign.id, new Date("2026-01-15T00:00:00.000Z"), { spend: 100, impressions: 1000, clicks: 100, reach: 800 }));

  const user = makeUser({ id: "cu", clientId: client.id });
  const data = await getClientDashboardData(user, client.id, db, RANGE);

  assert.equal(data.period.change.spend, null);
  assert.equal(data.period.change.impressions, null);
  assert.equal(data.period.change.reach, null);
  // clicks is unchanged → a valid 0% change, not null.
  assert.equal(data.period.change.clicks, 0);
  // A rate metric that INCREASED despite falling counts is still valid.
  assert.ok(Math.abs(data.period.change.ctr! - 100) < 1e-9); // (10 - 5) / 5 * 100

  db.close();
});

test("dashboard read: missing previous reading yields null change (zero denominator)", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const client = await createClient(db, pkg.id, "Client One");
  const account = await createAdAccount(db, client.id, "Account A");
  const campaign = await createCampaign(db, account.id, "Campaign A");

  // Only a current-period snapshot exists — no previous reading at all.
  await new SqliteInsightSnapshotRepository(db).append(
    snapshot(campaign.id, new Date("2026-01-15T00:00:00.000Z"), { spend: 50, impressions: 1000, results: 20 })
  );

  const user = makeUser({ id: "cu", clientId: client.id });
  const data = await getClientDashboardData(user, client.id, db, RANGE);

  assert.equal(data.period.change.spend, null);
  assert.equal(data.period.change.impressions, null);
  assert.equal(data.period.change.costPerResult, null); // previous results = 0

  db.close();
});

test("dashboard read: data only in the previous window yields an empty current period", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const client = await createClient(db, pkg.id, "Client One");
  const account = await createAdAccount(db, client.id, "Account A");
  const campaign = await createCampaign(db, account.id, "Campaign A");

  await new SqliteInsightSnapshotRepository(db).append(
    snapshot(campaign.id, new Date("2026-01-05T00:00:00.000Z"), { spend: 50 })
  );

  const user = makeUser({ id: "cu", clientId: client.id });
  const data = await getClientDashboardData(user, client.id, db, RANGE);

  assert.equal(data.snapshotCount, 0);
  assert.equal(data.values.spend, 0);
  assert.equal(data.period.change.spend, null);

  db.close();
});

test("dashboard read: the 7/30/90 selection filters which captured_at windows contribute", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const client = await createClient(db, pkg.id, "Client One");
  const account = await createAdAccount(db, client.id, "Account A");
  const campaignA = await createCampaign(db, account.id, "Campaign A");
  const campaignB = await createCampaign(db, account.id, "Campaign B");

  const snapshots = new SqliteInsightSnapshotRepository(db);
  // Campaign A was last collected ~2.5 months ago: inside 90 days, outside 7.
  await snapshots.append(
    snapshot(campaignA.id, new Date("2026-06-01T00:00:00.000Z"), { impressions: 500 })
  );
  // Campaign B was collected within the last week: inside both windows.
  await snapshots.append(
    snapshot(campaignB.id, new Date("2026-08-10T00:00:00.000Z"), { impressions: 200 })
  );

  const user = makeUser({ id: "cu", clientId: client.id });
  const now = new Date("2026-08-15T12:00:00.000Z");

  const data7 = await getClientDashboardData(
    user,
    client.id,
    db,
    reportingRangeForDays(7, now)
  );
  assert.equal(data7.snapshotCount, 1);
  assert.equal(data7.values.impressions, 200);

  const data90 = await getClientDashboardData(
    user,
    client.id,
    db,
    reportingRangeForDays(90, now)
  );
  assert.equal(data90.snapshotCount, 2);
  assert.equal(data90.values.impressions, 700);

  db.close();
});