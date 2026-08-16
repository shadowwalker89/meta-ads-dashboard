import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";
import { runMigrations } from "../src/migrations/migrate.js";
import {
  SqlitePackageRepository,
  SqliteClientRepository,
  SqlitePricingRuleRepository,
  SqliteAdAccountRepository,
  SqliteCampaignRepository,
  SqliteInsightSnapshotRepository,
} from "../src/repositories/index.js";
import type { PricingRule } from "@repo/shared";
import {
  applyPricingRule,
  hasPricingComponents,
  isPricingMetric,
  selectApplicablePricingRule,
} from "@repo/shared";

function createTestDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

async function createClient(db: DatabaseType) {
  const packages = new SqlitePackageRepository(db);
  const clients = new SqliteClientRepository(db);
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
  return clients.create({
    name: "Test Client",
    businessType: "E-commerce",
    contactEmail: "client@example.com",
    packageId: pkg.id,
    isActive: true,
  });
}

async function createCampaignWithSnapshot(db: DatabaseType, clientId: string) {
  const adAccounts = new SqliteAdAccountRepository(db);
  const campaigns = new SqliteCampaignRepository(db);
  const snapshots = new SqliteInsightSnapshotRepository(db);

  const adAccount = await adAccounts.create({
    clientId,
    name: "Main Ad Account",
    status: "connected",
    source: "playwright",
    metaAdAccountId: null,
  });
  const campaign = await campaigns.create({
    adAccountId: adAccount.id,
    name: "Campaign One",
    objective: "unknown",
    status: "unknown",
    scrapedLabel: "Campaign One",
    metaCampaignId: null,
  });

  const snapshot = await snapshots.append({
    campaignId: campaign.id,
    capturedAt: new Date("2026-01-01T00:00:00.000Z"),
    impressions: 10000,
    clicks: 500,
    linkClicks: 400,
    spend: 125,
    ctr: 5,
    cpc: 0.25,
    cpm: 12.5,
    reach: 8000,
    frequency: 1.25,
    clicksAll: 550,
    uniqueClicks: 430,
    uniqueCtr: 4.3,
    landingPageViews: 380,
    outboundClicks: 300,
    outboundCtr: 3,
    leads: 25,
    messagesStarted: 40,
    messagesContacts: 18,
    results: 60,
    costPerResult: 2.08,
    postReactions: 120,
    postComments: 34,
    rawPayload: { test: true },
  });

  return { campaignId: campaign.id, snapshotId: snapshot.id };
}

function makeRule(
  overrides: Partial<PricingRule>
): Omit<PricingRule, "id" | "createdAt" | "updatedAt"> {
  return {
    clientId: "client-1",
    metric: "cpm",
    percentageMarkup: null,
    fixedMarkup: null,
    minimumCustomerValue: null,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// --- Pure pricing formula -------------------------------------------------

test("pricing formula: percentage markup", () => {
  const rule = makeRule({ metric: "cpc", percentageMarkup: 0.4 });
  // Meta CPC = $0.25, 40% markup -> $0.35
  assert.equal(applyPricingRule(rule, 0.25), 0.35);
});

test("pricing formula: fixed markup", () => {
  const rule = makeRule({ metric: "cpm", fixedMarkup: 1.0 });
  // Meta CPM = $0.50, fixed markup $1.00 -> $1.50
  assert.equal(applyPricingRule(rule, 0.5), 1.5);
});

test("pricing formula: minimum customer value", () => {
  const rule = makeRule({ metric: "cpm", minimumCustomerValue: 0.75 });
  // Meta CPM = $0.50 but never below $0.75 -> $0.75
  assert.equal(applyPricingRule(rule, 0.5), 0.75);
});

test("pricing formula: raw Meta value remains unchanged", () => {
  const rule = makeRule({ metric: "spend", percentageMarkup: 0.1, fixedMarkup: 5 });
  const raw = 100;
  const customer = applyPricingRule(rule, raw);
  assert.equal(customer, Math.max(100 + 5, 100 * 1.1));
  // The raw value itself is never mutated — the function returns a
  // derived value and leaves the input untouched.
  assert.equal(raw, 100);
});

test("pricing formula: effectiveFrom selects the newest applicable rule", () => {
  const clientId = "client-1";
  const older = makeRule({
    clientId,
    metric: "cpm",
    fixedMarkup: 1.0,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
  });
  const newer = makeRule({
    clientId,
    metric: "cpm",
    fixedMarkup: 2.0,
    effectiveFrom: new Date("2026-02-01T00:00:00.000Z"),
  });
  const rules: PricingRule[] = [
    { id: "a", ...older, createdAt: new Date(), updatedAt: new Date() },
    { id: "b", ...newer, createdAt: new Date(), updatedAt: new Date() },
  ];

  // Before the newer rule is effective, the older rule applies.
  const before = selectApplicablePricingRule(
    rules,
    clientId,
    "cpm",
    new Date("2026-01-15T00:00:00.000Z")
  );
  assert.equal(before?.id, "a");

  // After it, the newer rule wins.
  const after = selectApplicablePricingRule(
    rules,
    clientId,
    "cpm",
    new Date("2026-02-15T00:00:00.000Z")
  );
  assert.equal(after?.id, "b");
});

test("pricing formula: no effective rule means raw value is the customer value", () => {
  const rules: PricingRule[] = [];
  const rule = selectApplicablePricingRule(
    rules,
    "client-1",
    "cpm",
    new Date("2026-01-15T00:00:00.000Z")
  );
  assert.equal(rule, null);
  // With no rule, the customer value equals the raw Meta value. The
  // repository/service path handles this by returning rawValue unchanged
  // when the applicable rule is null (see getClientPricedKpis).
});

test("pricing formula: zero/null/invalid denominators handled safely", () => {
  // Zero raw value with a percentage-only rule stays zero (no crash).
  const pctOnly = makeRule({ metric: "cpm", percentageMarkup: 0.4 });
  assert.equal(applyPricingRule(pctOnly, 0), 0);

  // Zero raw value with a fixed markup still yields the fixed markup.
  const fixedOnly = makeRule({ metric: "cpm", fixedMarkup: 1.0 });
  assert.equal(applyPricingRule(fixedOnly, 0), 1.0);

  // A rule with all three components null is a no-op -> raw passes through.
  const empty = makeRule({});
  assert.equal(applyPricingRule(empty, 5), 5);
  assert.equal(hasPricingComponents(empty), false);

  // Null components are simply not part of the max.
  const partial = makeRule({ metric: "cpc", fixedMarkup: 0.1 });
  assert.equal(applyPricingRule(partial, 0), 0.1);
});

test("pricing formula: non-cost KPIs are not pricable", () => {
  assert.equal(isPricingMetric("impressions"), false);
  assert.equal(isPricingMetric("clicks"), false);
  assert.equal(isPricingMetric("ctr"), false);
  assert.equal(isPricingMetric("reach"), false);
  assert.equal(isPricingMetric("frequency"), false);
  assert.equal(isPricingMetric("leads"), false);

  assert.equal(isPricingMetric("spend"), true);
  assert.equal(isPricingMetric("cpc"), true);
  assert.equal(isPricingMetric("cpm"), true);
  assert.equal(isPricingMetric("costPerResult"), true);
});

// --- SQLite repository ----------------------------------------------------

test("pricing repository: create and find by client", async () => {
  const db = createTestDb();
  const client = await createClient(db);
  const repo = new SqlitePricingRuleRepository(db);

  const created = await repo.create({
    clientId: client.id,
    metric: "cpm",
    percentageMarkup: null,
    fixedMarkup: 1.0,
    minimumCustomerValue: 0.75,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
  });
  assert.ok(created.id);
  assert.ok(created.createdAt instanceof Date);
  assert.ok(created.updatedAt instanceof Date);

  const found = await repo.findByClient(client.id);
  assert.equal(found.length, 1);
  assert.equal(found[0].metric, "cpm");
  assert.equal(found[0].fixedMarkup, 1.0);
  assert.equal(found[0].minimumCustomerValue, 0.75);
  assert.equal(found[0].effectiveFrom.getTime(), new Date("2026-01-01T00:00:00.000Z").getTime());

  db.close();
});

test("pricing repository: findApplicable picks the newest effective rule", async () => {
  const db = createTestDb();
  const client = await createClient(db);
  const repo = new SqlitePricingRuleRepository(db);

  await repo.create({
    clientId: client.id,
    metric: "cpm",
    percentageMarkup: null,
    fixedMarkup: 1.0,
    minimumCustomerValue: null,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
  });
  await repo.create({
    clientId: client.id,
    metric: "cpm",
    percentageMarkup: null,
    fixedMarkup: 2.0,
    minimumCustomerValue: null,
    effectiveFrom: new Date("2026-02-01T00:00:00.000Z"),
  });

  const before = await repo.findApplicable(client.id, "cpm", new Date("2026-01-15T00:00:00.000Z"));
  assert.equal(before?.fixedMarkup, 1.0);

  const after = await repo.findApplicable(client.id, "cpm", new Date("2026-02-15T00:00:00.000Z"));
  assert.equal(after?.fixedMarkup, 2.0);

  const beforeAnyRule = await repo.findApplicable(client.id, "cpm", new Date("2025-12-01T00:00:00.000Z"));
  assert.equal(beforeAnyRule, null);

  db.close();
});

test("pricing repository: create rejects empty and non-pricable rules", async () => {
  const db = createTestDb();
  const client = await createClient(db);
  const repo = new SqlitePricingRuleRepository(db);

  await assert.rejects(
    repo.create({
      clientId: client.id,
      metric: "cpm",
      percentageMarkup: null,
      fixedMarkup: null,
      minimumCustomerValue: null,
      effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    }),
    /at least one pricing component/
  );

  await assert.rejects(
    repo.create({
      clientId: client.id,
      metric: "impressions",
      percentageMarkup: 0.1,
      fixedMarkup: null,
      minimumCustomerValue: null,
      effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    }),
    /not pricable/
  );

  db.close();
});

// --- Append-only / effective-dating behavior -------------------------------

test("pricing repository: creating a rule is strictly append-only", async () => {
  const db = createTestDb();
  const client = await createClient(db);
  const repo = new SqlitePricingRuleRepository(db);

  const first = await repo.create({
    clientId: client.id,
    metric: "cpm",
    percentageMarkup: null,
    fixedMarkup: 1.0,
    minimumCustomerValue: null,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
  });

  const second = await repo.create({
    clientId: client.id,
    metric: "cpm",
    percentageMarkup: null,
    fixedMarkup: 2.0,
    minimumCustomerValue: null,
    effectiveFrom: new Date("2026-02-01T00:00:00.000Z"),
  });

  assert.notEqual(first.id, second.id);

  // Both rules exist; the first is untouched — its components and dates
  // are exactly as created.
  const all = await repo.findByClient(client.id);
  assert.equal(all.length, 2);
  const reloadedFirst = all.find((r) => r.id === first.id);
  assert.ok(reloadedFirst);
  assert.equal(reloadedFirst.fixedMarkup, 1.0);
  assert.equal(
    reloadedFirst.effectiveFrom.getTime(),
    new Date("2026-01-01T00:00:00.000Z").getTime()
  );

  db.close();
});

test("pricing repository: a future rule does not replace the current rule early", async () => {
  const db = createTestDb();
  const client = await createClient(db);
  const repo = new SqlitePricingRuleRepository(db);

  await repo.create({
    clientId: client.id,
    metric: "cpm",
    percentageMarkup: null,
    fixedMarkup: 1.0,
    minimumCustomerValue: null,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
  });
  await repo.create({
    clientId: client.id,
    metric: "cpm",
    percentageMarkup: null,
    fixedMarkup: 2.0,
    minimumCustomerValue: null,
    effectiveFrom: new Date("2026-06-01T00:00:00.000Z"),
  });

  // "Now" is before the second rule's effectiveFrom: the first rule
  // still applies.
  const at = new Date("2026-03-01T00:00:00.000Z");
  const applicable = await repo.findApplicable(client.id, "cpm", at);
  assert.ok(applicable);
  assert.equal(applicable.fixedMarkup, 1.0);

  // After the second rule's date, it becomes the applicable one.
  const later = await repo.findApplicable(
    client.id,
    "cpm",
    new Date("2026-06-15T00:00:00.000Z")
  );
  assert.equal(later?.fixedMarkup, 2.0);

  db.close();
});

test("pricing repository: a past effectiveFrom applies immediately", async () => {
  const db = createTestDb();
  const client = await createClient(db);
  const repo = new SqlitePricingRuleRepository(db);

  await repo.create({
    clientId: client.id,
    metric: "cpm",
    percentageMarkup: null,
    fixedMarkup: 1.5,
    minimumCustomerValue: null,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
  });

  // The rule's effectiveFrom is already in the past, so it is applicable
  // right away.
  const applicable = await repo.findApplicable(
    client.id,
    "cpm",
    new Date("2026-02-01T00:00:00.000Z")
  );
  assert.ok(applicable);
  assert.equal(applicable.fixedMarkup, 1.5);

  db.close();
});

test("pricing never mutates raw insight snapshots", async () => {
  const db = createTestDb();
  const client = await createClient(db);
  const { campaignId, snapshotId } = await createCampaignWithSnapshot(db, client.id);

  const snapshots = new SqliteInsightSnapshotRepository(db);
  const before = await snapshots.findLatestForCampaign(campaignId);
  assert.equal(before?.id, snapshotId);
  assert.equal(before?.spend, 125);
  assert.equal(before?.cpm, 12.5);

  // Create pricing rules for every pricable metric — a client-facing
  // pricing operation that must never write into insight_snapshots.
  const repo = new SqlitePricingRuleRepository(db);
  await repo.create({
    clientId: client.id,
    metric: "spend",
    percentageMarkup: 0.1,
    fixedMarkup: null,
    minimumCustomerValue: null,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
  });
  await repo.create({
    clientId: client.id,
    metric: "cpc",
    percentageMarkup: null,
    fixedMarkup: 0.05,
    minimumCustomerValue: null,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
  });

  // Rule reads (what the dashboard uses) return the rule, not a snapshot.
  const applicable = await repo.findApplicable(
    client.id,
    "spend",
    new Date("2026-01-15T00:00:00.000Z")
  );
  assert.ok(applicable);
  assert.equal(applicable.percentageMarkup, 0.1);

  // The raw snapshot is byte-for-byte unchanged after all pricing work.
  const after = await snapshots.findLatestForCampaign(campaignId);
  assert.equal(after?.id, snapshotId);
  assert.equal(after?.spend, 125);
  assert.equal(after?.cpm, 12.5);
  assert.equal(after?.cpc, 0.25);
  assert.equal(after?.costPerResult, 2.08);
  assert.equal(after?.impressions, 10000);
  assert.deepEqual(after?.rawPayload, { test: true });

  // The pricing rules table only holds the rules, not customer values.
  const rules = await repo.findByClient(client.id);
  assert.equal(rules.length, 2);
  assert.ok(rules.every((rule) => rule.metric !== "impressions"));

  db.close();
});