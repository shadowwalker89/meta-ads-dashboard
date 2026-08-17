import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDatabase, runMigrations } from "@repo/database";
import {
  SqliteAdAccountRepository,
  SqliteCampaignRepository,
  SqliteClientRepository,
  SqliteCollectorJobRepository,
  SqliteInsightSnapshotRepository,
  SqlitePackageEnforcement,
  SqlitePackageRepository,
  SqlitePricingRuleRepository,
} from "@repo/database";
import {
  applyPricingRule,
  selectApplicablePricingRule,
  type AdAccount,
  type Package,
} from "@repo/shared";
import { CollectionScheduler } from "../src/collection-scheduler.js";
import { CollectorOrchestrator } from "../src/collector-orchestrator.js";
import { MetricsParser } from "../src/metrics-parser.js";
import type { CollectorProvider } from "../src/collector-provider.js";
import type { RawCampaignMetrics } from "../src/raw-campaign-metrics.js";

const REF = new Date("2026-08-15T12:00:00.000Z");
const HOUR_MS = 60 * 60 * 1000;

function iso(hoursAgo: number): string {
  return new Date(REF.getTime() - hoursAgo * HOUR_MS).toISOString();
}

class StubCollectorProvider implements CollectorProvider {
  calledFor: string[] = [];

  constructor(private readonly rows: RawCampaignMetrics[] = []) {}

  async collect(adAccount: AdAccount): Promise<RawCampaignMetrics[]> {
    this.calledFor.push(adAccount.id);
    return this.rows;
  }
}

function rawRow(
  scrapedLabel: string,
  overrides: Partial<RawCampaignMetrics> = {}
): RawCampaignMetrics {
  return {
    scrapedLabel,
    metaCampaignId: null,
    reportingFrom: null,
    reportingTo: null,
    impressions: "1,000",
    clicks: "200",
    linkClicks: "200",
    spend: "50.00",
    ctr: "5",
    cpc: "0.25",
    cpm: "50",
    reach: "800",
    frequency: "1.25",
    clicksAll: "300",
    uniqueClicks: "150",
    uniqueCtr: "4",
    landingPageViews: "120",
    outboundClicks: "100",
    outboundCtr: "3",
    leads: "10",
    messagesStarted: "2",
    messagesContacts: "1",
    results: "10",
    costPerResult: "5.00",
    postReactions: "40",
    postComments: "5",
    ...overrides,
  };
}

function harness(rows: RawCampaignMetrics[] = []) {
  const db = openDatabase(":memory:");
  runMigrations(db);

  const clientRepository = new SqliteClientRepository(db);
  const adAccountRepository = new SqliteAdAccountRepository(db);
  const campaignRepository = new SqliteCampaignRepository(db);
  const packageRepository = new SqlitePackageRepository(db);
  const collectorJobRepository = new SqliteCollectorJobRepository(db);
  const insightSnapshotRepository = new SqliteInsightSnapshotRepository(db);

  const provider = new StubCollectorProvider(rows);
  const orchestrator = new CollectorOrchestrator({
    clientRepository,
    adAccountRepository,
    campaignRepository,
    collectorJobRepository,
    insightSnapshotRepository,
    collectorProvider: provider,
    metricsParser: new MetricsParser(),
    packageEnforcement: new SqlitePackageEnforcement(db),
  });

  const scheduler = new CollectionScheduler({
    clientRepository,
    adAccountRepository,
    packageRepository,
    collectorJobRepository,
    orchestrator,
  });

  return {
    db,
    scheduler,
    provider,
    clientRepository,
    adAccountRepository,
    campaignRepository,
    packageRepository,
    collectorJobRepository,
    insightSnapshotRepository,
  };
}

async function seedPackage(
  packageRepository: SqlitePackageRepository,
  overrides: Partial<Omit<Package, "id" | "createdAt">> = {}
) {
  return packageRepository.create({
    name: "Test Plan",
    description: "Test plan",
    code: "test",
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

async function seedClient(
  clientRepository: SqliteClientRepository,
  packageId: string,
  name: string
) {
  return clientRepository.create({
    name,
    businessType: "E-commerce",
    contactEmail: "client@example.com",
    packageId,
    isActive: true,
  });
}

async function seedAdAccount(
  adAccountRepository: SqliteAdAccountRepository,
  clientId: string,
  name: string
) {
  return adAccountRepository.create({
    clientId,
    name,
    status: "connected",
    source: "playwright",
    metaAdAccountId: null,
  });
}

function insertJob(
  db: ReturnType<typeof openDatabase>,
  adAccountId: string,
  startedAtIso: string,
  status: "success" | "failed" | "running" = "success"
) {
  db.prepare(
    `INSERT INTO collector_jobs (id, ad_account_id, source, status, started_at, finished_at)
     VALUES (?, ?, 'playwright', ?, ?, ?)`
  ).run(randomUUID(), adAccountId, status, startedAtIso, startedAtIso);
}

// --- Test 1: no previous job → due -------------------------------------

test("scheduler: an account with no previous job is due", async () => {
  const h = harness();
  const pkg = await seedPackage(h.packageRepository, { collectionFrequency: 1 });
  const client = await seedClient(h.clientRepository, pkg.id, "Client A");
  const account = await seedAdAccount(h.adAccountRepository, client.id, "Account 1");

  const due = await h.scheduler.findDueAdAccounts(REF);
  assert.equal(due.length, 1);
  assert.equal(due[0].adAccount.id, account.id);
  assert.equal(due[0].lastRunAt, null);

  h.db.close();
});

// --- Test 2: previous job older than interval → due --------------------

test("scheduler: a job older than the interval is due", async () => {
  const h = harness();
  const pkg = await seedPackage(h.packageRepository, { collectionFrequency: 1 });
  const client = await seedClient(h.clientRepository, pkg.id, "Client A");
  const account = await seedAdAccount(h.adAccountRepository, client.id, "Account 1");
  insertJob(h.db, account.id, iso(25)); // 25h ago > 24h interval

  const due = await h.scheduler.findDueAdAccounts(REF);
  assert.equal(due.length, 1);
  assert.equal(due[0].adAccount.id, account.id);
  assert.equal(due[0].collectionFrequency, 1);

  h.db.close();
});

// --- Test 3: previous job exactly at interval → due --------------------

test("scheduler: a job exactly at the interval boundary is due", async () => {
  const h = harness();
  const pkg = await seedPackage(h.packageRepository, { collectionFrequency: 1 });
  const client = await seedClient(h.clientRepository, pkg.id, "Client A");
  const account = await seedAdAccount(h.adAccountRepository, client.id, "Account 1");
  insertJob(h.db, account.id, iso(24)); // exactly 24h

  const due = await h.scheduler.findDueAdAccounts(REF);
  assert.equal(due.length, 1);

  h.db.close();
});

// --- Test 4: previous job newer than interval → not due ----------------

test("scheduler: a job newer than the interval is not due", async () => {
  const h = harness();
  const pkg = await seedPackage(h.packageRepository, { collectionFrequency: 1 });
  const client = await seedClient(h.clientRepository, pkg.id, "Client A");
  const account = await seedAdAccount(h.adAccountRepository, client.id, "Account 1");
  insertJob(h.db, account.id, iso(23)); // 23h ago < 24h interval

  const due = await h.scheduler.findDueAdAccounts(REF);
  assert.equal(due.length, 0);

  h.db.close();
});

// --- Test 5: different package frequencies → different intervals --------

test("scheduler: different package frequencies produce different due intervals", async () => {
  const h = harness();
  const dailyPkg = await seedPackage(h.packageRepository, {
    name: "Daily",
    code: "daily",
    collectionFrequency: 1,
  });
  const twoHourPkg = await seedPackage(h.packageRepository, {
    name: "TwoHour",
    code: "twohour",
    collectionFrequency: 12,
  });

  const clientDaily = await seedClient(h.clientRepository, dailyPkg.id, "Client Daily");
  const clientFast = await seedClient(h.clientRepository, twoHourPkg.id, "Client Fast");

  const accountDaily = await seedAdAccount(h.adAccountRepository, clientDaily.id, "Daily Acct");
  const accountFast = await seedAdAccount(h.adAccountRepository, clientFast.id, "Fast Acct");

  // Both ran 2 hours ago. At 2h the freq-12 account (interval 2h) is
  // due; the freq-1 account (interval 24h) is not.
  insertJob(h.db, accountDaily.id, iso(2));
  insertJob(h.db, accountFast.id, iso(2));

  const due = await h.scheduler.findDueAdAccounts(REF);
  assert.equal(due.length, 1);
  assert.equal(due[0].adAccount.id, accountFast.id);
  assert.equal(due[0].collectionFrequency, 12);

  h.db.close();
});

// --- Test 6: multiple ad accounts evaluated independently --------------

test("scheduler: multiple ad accounts are evaluated independently", async () => {
  const h = harness();
  const pkg = await seedPackage(h.packageRepository, { collectionFrequency: 1 });
  const client = await seedClient(h.clientRepository, pkg.id, "Client A");
  const dueAccount = await seedAdAccount(h.adAccountRepository, client.id, "Due");
  const freshAccount = await seedAdAccount(h.adAccountRepository, client.id, "Fresh");

  insertJob(h.db, dueAccount.id, iso(25)); // due
  insertJob(h.db, freshAccount.id, iso(1)); // not due

  const due = await h.scheduler.findDueAdAccounts(REF);
  assert.equal(due.length, 1);
  assert.equal(due[0].adAccount.id, dueAccount.id);

  h.db.close();
});

// --- Test 7: missing/invalid frequency falls back safely ---------------

test("scheduler: missing or invalid frequency falls back to 1/day", async () => {
  const h = harness();

  // Invalid stored frequency (0) bypassing repo validation, as corrupt
  // or legacy data might carry it.
  h.db
    .prepare(
      `INSERT INTO packages (id, name, description, collection_frequency, created_at)
       VALUES (?, ?, ?, 0, ?)`
    )
    .run("invalid-freq-pkg", "Broken Plan", "frequency 0", REF.toISOString());
  const clientInvalid = await seedClient(h.clientRepository, "invalid-freq-pkg", "Client Invalid");
  const accountInvalidFresh = await seedAdAccount(h.adAccountRepository, clientInvalid.id, "Invalid Fresh");

  // Dangling package reference (package deleted but client kept).
  const validPkg = await seedPackage(h.packageRepository, { name: "Gone", code: "gone" });
  const clientDangling = await seedClient(h.clientRepository, validPkg.id, "Client Dangling");
  const accountDanglingFresh = await seedAdAccount(h.adAccountRepository, clientDangling.id, "Dangling Fresh");
  h.db.pragma("foreign_keys = OFF");
  h.db.prepare("DELETE FROM packages WHERE id = ?").run(validPkg.id);
  h.db.pragma("foreign_keys = ON");

  // Default is 1/day → not due at 23h, due at exactly 24h.
  insertJob(h.db, accountInvalidFresh.id, iso(23));
  insertJob(h.db, accountDanglingFresh.id, iso(23));
  assert.equal((await h.scheduler.findDueAdAccounts(REF)).length, 0);

  // A second set of accounts whose only job is exactly at the 24h
  // boundary → both fallbacks judge them due.
  const accountInvalidDue = await seedAdAccount(h.adAccountRepository, clientInvalid.id, "Invalid Due");
  const accountDanglingDue = await seedAdAccount(h.adAccountRepository, clientDangling.id, "Dangling Due");
  insertJob(h.db, accountInvalidDue.id, iso(24));
  insertJob(h.db, accountDanglingDue.id, iso(24));
  const due = await h.scheduler.findDueAdAccounts(REF);
  assert.equal(due.length, 2);
  for (const entry of due) {
    assert.equal(entry.collectionFrequency, 1);
  }

  h.db.close();
});

// --- Test 8: collection invoked only for due accounts ------------------

test("scheduler: invokes collection only for due accounts", async () => {
  const h = harness();
  const pkg = await seedPackage(h.packageRepository, { collectionFrequency: 1 });
  const client = await seedClient(h.clientRepository, pkg.id, "Client A");
  const dueAccount = await seedAdAccount(h.adAccountRepository, client.id, "Due");
  const freshAccount = await seedAdAccount(h.adAccountRepository, client.id, "Fresh");

  insertJob(h.db, freshAccount.id, iso(1)); // not due

  const result = await h.scheduler.runDueCollections(REF);
  assert.equal(result.evaluated, 2);
  assert.equal(result.collected, 1);
  assert.equal(result.skipped, 1);

  assert.deepEqual(h.provider.calledFor, [dueAccount.id]);

  // Due account now has exactly one (new) job; fresh account still has
  // only its original job.
  const dueLatest = await h.collectorJobRepository.findLatestForAdAccount(dueAccount.id);
  assert.ok(dueLatest);
  assert.equal(dueLatest.status, "success");

  const freshJobs = h.db
    .prepare("SELECT COUNT(*) AS n FROM collector_jobs WHERE ad_account_id = ?")
    .get(freshAccount.id) as { n: number };
  assert.equal(freshJobs.n, 1);

  h.db.close();
});

// --- Test 9: no collection for accounts that are not due ---------------

test("scheduler: does not invoke collection for accounts that are not due", async () => {
  const h = harness();
  const pkg = await seedPackage(h.packageRepository, { collectionFrequency: 1 });
  const client = await seedClient(h.clientRepository, pkg.id, "Client A");
  const account = await seedAdAccount(h.adAccountRepository, client.id, "Account 1");
  insertJob(h.db, account.id, iso(1)); // not due

  const result = await h.scheduler.runDueCollections(REF);
  assert.equal(result.evaluated, 1);
  assert.equal(result.collected, 0);
  assert.equal(result.skipped, 1);
  assert.deepEqual(h.provider.calledFor, []);

  const latest = await h.collectorJobRepository.findLatestForAdAccount(account.id);
  assert.equal(latest?.status, "success");
  assert.equal(latest?.startedAt.getTime(), new Date(iso(1)).getTime());

  h.db.close();
});

// --- Test 10: campaign-limit enforcement still works -------------------

test("scheduler: package campaign-limit enforcement still applies during collection", async () => {
  const h = harness([rawRow("New Campaign")]);
  const pkg = await seedPackage(h.packageRepository, { maxCampaigns: 1 });
  const client = await seedClient(h.clientRepository, pkg.id, "Client A");
  const account = await seedAdAccount(h.adAccountRepository, client.id, "Account 1");

  // One existing campaign fills the client's single campaign slot.
  await h.campaignRepository.create({
    adAccountId: account.id,
    name: "Existing",
    objective: "unknown",
    status: "unknown",
    scrapedLabel: "Existing",
    metaCampaignId: null,
  });

  // Account is due (no job). Collection runs, but discovering the new
  // campaign hits the package limit → job is marked failed.
  const result = await h.scheduler.runDueCollections(REF);
  assert.equal(result.collected, 1);

  const latest = await h.collectorJobRepository.findLatestForAdAccount(account.id);
  assert.ok(latest);
  assert.equal(latest.status, "failed");
  assert.match(latest.errorMessage ?? "", /maximum number of campaigns \(1\)/);

  const campaigns = await h.campaignRepository.findByAdAccount(account.id);
  assert.equal(campaigns.length, 1);
  assert.equal(campaigns[0].name, "Existing");

  h.db.close();
});

// --- Test 11: scheduler does not modify raw InsightSnapshot values -----

test("scheduler: collected raw InsightSnapshot values are preserved", async () => {
  const h = harness([rawRow("Summer Sale")]);
  const pkg = await seedPackage(h.packageRepository);
  const client = await seedClient(h.clientRepository, pkg.id, "Client A");
  const account = await seedAdAccount(h.adAccountRepository, client.id, "Account 1");

  await h.scheduler.runDueCollections(REF);

  const campaigns = await h.campaignRepository.findByAdAccount(account.id);
  assert.equal(campaigns.length, 1);
  const snapshot = await h.insightSnapshotRepository.findLatestForCampaign(campaigns[0].id);
  assert.ok(snapshot);

  // Exact parser output — the scheduler never touched these values.
  assert.equal(snapshot.impressions, 1000);
  assert.equal(snapshot.clicks, 200);
  assert.equal(snapshot.linkClicks, 200);
  assert.equal(snapshot.spend, 50);
  assert.equal(snapshot.ctr, 5);
  assert.equal(snapshot.cpc, 0.25);
  assert.equal(snapshot.cpm, 50);
  assert.equal(snapshot.reach, 800);
  assert.equal(snapshot.costPerResult, 5);
  assert.equal(snapshot.rawPayload?.scrapedLabel, "Summer Sale");

  // Boundary fields are carried through rawPayload (groundwork for a
  // future migration) and the reporting-window fields are now persisted
  // as nullable InsightSnapshot columns — null here, never derived.
  assert.equal(snapshot.rawPayload?.reportingFrom, null);
  assert.equal(snapshot.rawPayload?.reportingTo, null);
  assert.equal(snapshot.rawPayload?.metaCampaignId, null);
  assert.equal(snapshot.reportingFrom, null);
  assert.equal(snapshot.reportingTo, null);
  assert.equal("reportingFrom" in snapshot, true);
  assert.equal("reportingTo" in snapshot, true);

  h.db.close();
});

// --- Test 12: pricing behavior remains unchanged -----------------------

test("scheduler: pricing rules and calculation remain unchanged", async () => {
  const h = harness([rawRow("Summer Sale")]);
  const pkg = await seedPackage(h.packageRepository);
  const client = await seedClient(h.clientRepository, pkg.id, "Client A");
  const account = await seedAdAccount(h.adAccountRepository, client.id, "Account 1");

  const pricing = new SqlitePricingRuleRepository(h.db);
  const rule = await pricing.create({
    clientId: client.id,
    metric: "cpc",
    percentageMarkup: null,
    fixedMarkup: 0.1,
    minimumCustomerValue: null,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
  });

  await h.scheduler.runDueCollections(REF);

  // Scheduler created no extra rules and raw values are untouched.
  const rules = await pricing.findByClient(client.id);
  assert.equal(rules.length, 1);

  const campaigns = await h.campaignRepository.findByAdAccount(account.id);
  const snapshot = await h.insightSnapshotRepository.findLatestForCampaign(campaigns[0].id);
  assert.ok(snapshot);
  assert.equal(snapshot.cpc, 0.25);

  // The existing pricing calculation still yields the same customer
  // value for the raw value, unchanged by the scheduler run.
  const applicable = selectApplicablePricingRule(rules, client.id, "cpc", REF);
  assert.equal(applicable?.id, rule.id);
  assert.equal(applyPricingRule(applicable, snapshot.cpc), 0.35);

  h.db.close();
});

// --- Reporting-window persistence (Phase 2H) ----------------------------

test("reporting window: confirmed YYYY-MM-DD bounds survive collector → SQLite → domain", async () => {
  const h = harness([
    rawRow("Iraq Lead Campaign", {
      reportingFrom: "2025-11-28",
      reportingTo: "2026-08-18",
    }),
  ]);
  const pkg = await seedPackage(h.packageRepository);
  const client = await seedClient(h.clientRepository, pkg.id, "Client A");
  const account = await seedAdAccount(h.adAccountRepository, client.id, "Account 1");

  await h.scheduler.runDueCollections(REF);

  const campaigns = await h.campaignRepository.findByAdAccount(account.id);
  const snapshot = await h.insightSnapshotRepository.findLatestForCampaign(campaigns[0].id);
  assert.ok(snapshot);
  assert.equal(snapshot.reportingFrom?.toISOString(), "2025-11-28T00:00:00.000Z");
  assert.equal(snapshot.reportingTo?.toISOString(), "2026-08-18T00:00:00.000Z");

  // Critical invariant: capturedAt is the capture instant, never equal
  // to either reporting bound, and never a substitute for them.
  assert.notEqual(snapshot.capturedAt.toISOString(), snapshot.reportingFrom?.toISOString());
  assert.notEqual(snapshot.capturedAt.toISOString(), snapshot.reportingTo?.toISOString());
  assert.equal(snapshot.reportingFrom?.getTime() < snapshot.capturedAt.getTime(), true);

  h.db.close();
});

test("reporting window: missing bounds persist as NULL, never derived from capturedAt", async () => {
  const h = harness([rawRow("No Bounds")]);
  const pkg = await seedPackage(h.packageRepository);
  const client = await seedClient(h.clientRepository, pkg.id, "Client A");
  const account = await seedAdAccount(h.adAccountRepository, client.id, "Account 1");

  await h.scheduler.runDueCollections(REF);

  const campaigns = await h.campaignRepository.findByAdAccount(account.id);
  const snapshot = await h.insightSnapshotRepository.findLatestForCampaign(campaigns[0].id);
  assert.ok(snapshot);
  assert.equal(snapshot.reportingFrom, null);
  assert.equal(snapshot.reportingTo, null);
  assert.ok(snapshot.capturedAt instanceof Date, "capturedAt is still recorded");

  h.db.close();
});

test("reporting window: a partial bound is stored as-is, the missing side stays NULL", async () => {
  const h = harness([
    rawRow("Partial Bounds", { reportingFrom: "2026-08-01", reportingTo: null }),
  ]);
  const pkg = await seedPackage(h.packageRepository);
  const client = await seedClient(h.clientRepository, pkg.id, "Client A");
  const account = await seedAdAccount(h.adAccountRepository, client.id, "Account 1");

  await h.scheduler.runDueCollections(REF);

  const campaigns = await h.campaignRepository.findByAdAccount(account.id);
  const snapshot = await h.insightSnapshotRepository.findLatestForCampaign(campaigns[0].id);
  assert.ok(snapshot);
  assert.equal(snapshot.reportingFrom?.toISOString(), "2026-08-01T00:00:00.000Z");
  assert.equal(snapshot.reportingTo, null);

  h.db.close();
});

test("reporting window: a non-YYYY-MM-DD value fails the job loudly, never guessed", async () => {
  const h = harness([
    rawRow("Bad Window", { reportingFrom: "2026/08/18", reportingTo: "2026-08-18" }),
  ]);
  const pkg = await seedPackage(h.packageRepository);
  const client = await seedClient(h.clientRepository, pkg.id, "Client A");
  const account = await seedAdAccount(h.adAccountRepository, client.id, "Account 1");

  await h.scheduler.runDueCollections(REF);

  const latest = await h.collectorJobRepository.findLatestForAdAccount(account.id);
  assert.ok(latest);
  assert.equal(latest.status, "failed");
  assert.match(latest.errorMessage ?? "", /Invalid reporting date/);
  assert.match(latest.errorMessage ?? "", /2026\/08\/18/);

  h.db.close();
});