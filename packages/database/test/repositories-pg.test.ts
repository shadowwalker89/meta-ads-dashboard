import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { DashboardKpiKey } from "@repo/shared";
import {
  openPostgresDatabase,
  type PostgresDatabase,
} from "../src/client-pg.js";
import { runPostgresMigrations } from "../src/migrations-pg/migrate-pg.js";
import {
  PgAdminAssignmentRepository,
  PgDashboardPreferenceRepository,
  PgInsightSnapshotRepository,
  PgPricingRuleRepository,
  PgUserRepository,
  PgClientRepository,
  PgPackageRepository,
  PgAdAccountRepository,
  PgCampaignRepository,
  PgAuditLogRepository,
  PgCollectorJobRepository,
} from "../src/index.js";
import {
  bigIntColumn,
  jsonbColumn,
  timestampColumn,
} from "../src/repositories/pg-row-convert.js";

// ---------------------------------------------------------------------------
// Conversion-layer unit checks — always run, never touch a database.
// ---------------------------------------------------------------------------

test("pg convert: BIGINT strings become exact numbers, unsafe values refuse", () => {
  assert.equal(bigIntColumn("42", "clicks"), 42);
  assert.equal(bigIntColumn(7, "clicks"), 7);
  // A cumulative Meta counter beyond INT4 but within safe-double range.
  assert.equal(bigIntColumn("5000000000", "impressions"), 5_000_000_000);
  assert.throws(() => bigIntColumn("9007199254740993", "impressions"), /MAX_SAFE_INTEGER/);
  assert.throws(() => bigIntColumn("abc", "impressions"), /non-numeric/);
});

test("pg convert: timestamps parse to valid Dates; JSONB tolerates parsed and text shapes", () => {
  const date = timestampColumn(new Date("2026-08-01T00:00:00Z"), "captured_at");
  assert.equal(date.toISOString(), "2026-08-01T00:00:00.000Z");
  assert.equal(timestampColumn("2026-08-01T00:00:00Z", "captured_at").toISOString(), "2026-08-01T00:00:00.000Z");
  assert.throws(() => timestampColumn("not-a-date", "captured_at"), /invalid timestamp/);

  const payload = { source: "demo" };
  assert.deepEqual(jsonbColumn<Record<string, unknown>>(payload), payload);
  assert.deepEqual(jsonbColumn<Record<string, unknown>>('{"source":"demo"}'), payload);
  assert.equal(jsonbColumn(null), null);
});

// ---------------------------------------------------------------------------
// Repository integration checks — REQUIRE a disposable PostgreSQL database
// (TEST_DATABASE_URL). Skipped EXPLICITLY otherwise; never fake-passed.
// ---------------------------------------------------------------------------

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const pgTestOptions = TEST_DATABASE_URL
  ? ({ skip: false as const })
  : ({ skip: "TEST_DATABASE_URL not set — PostgreSQL integration skipped" });

async function freshMigratedDb(): Promise<PostgresDatabase> {
  const db = openPostgresDatabase({ connectionString: TEST_DATABASE_URL });
  await db.execute("DROP SCHEMA IF EXISTS public CASCADE");
  await db.execute("CREATE SCHEMA public");
  await runPostgresMigrations(db);
  return db;
}

interface SeedIds {
  packageId: string;
  clientId: string;
  adminUserId: string;
  adAccountId: string;
  campaignAId: string;
  campaignBId: string;
}

/** Parent-chain seeding via direct SQL: the Wave 2 repositories these
 *  tables belong to do not exist yet, so FK-valid rows are inserted
 *  directly. Production code paths remain untouched. */
async function seedParents(db: PostgresDatabase): Promise<SeedIds> {
  const ids: SeedIds = {
    packageId: randomUUID(),
    clientId: randomUUID(),
    adminUserId: randomUUID(),
    adAccountId: randomUUID(),
    campaignAId: randomUUID(),
    campaignBId: randomUUID(),
  };
  const now = new Date();
  await db.execute(
    `INSERT INTO packages (id, name, description, metric_thresholds, created_at,
       collection_frequency, default_visible_kpis, features, pricing_defaults)
     VALUES ($1, 'PG Test Pkg', 'seed', '{}', $2, 1, '[]', '{}', '{}')`,
    [ids.packageId, now]
  );
  await db.execute(
    `INSERT INTO clients (id, name, business_type, contact_email, package_id, is_active, created_at)
     VALUES ($1, 'PG Test Client', 'seed', 'seed@example.com', $2, true, $3)`,
    [ids.clientId, ids.packageId, now]
  );
  await db.execute(
    `INSERT INTO users (id, role, full_name, email, created_at)
     VALUES ($1, 'admin', 'PG Admin', $2, $3)`,
    [ids.adminUserId, `admin-${ids.adminUserId}@example.com`, now]
  );
  await db.execute(
    `INSERT INTO ad_accounts (id, client_id, name, status, source, created_at)
     VALUES ($1, $2, 'PG AdAccount', 'connected', 'playwright', $3)`,
    [ids.adAccountId, ids.clientId, now]
  );
  for (const [campaignId, label] of [
    [ids.campaignAId, "A"],
    [ids.campaignBId, "B"],
  ] as const) {
    await db.execute(
      `INSERT INTO campaigns (id, ad_account_id, name, objective, status, created_at)
       VALUES ($1, $2, $3, 'OUTREACH', 'ACTIVE', $4)`,
      [campaignId, ids.adAccountId, `Campaign ${label}`, now]
    );
  }
  return ids;
}

function snapshotFor(campaignId: string, capturedAt: Date, impressions: number) {
  return {
    campaignId,
    capturedAt,
    reportingFrom: null,
    reportingTo: null,
    impressions,
    clicks: 100,
    linkClicks: 90,
    spend: 50.5,
    ctr: 2,
    cpc: 0.5,
    cpm: 1.1,
    reach: 8000,
    frequency: 1.25,
    clicksAll: 110,
    uniqueClicks: 80,
    uniqueCtr: 1,
    landingPageViews: 70,
    outboundClicks: 60,
    outboundCtr: 0.75,
    leads: 5,
    messagesStarted: 2,
    messagesContacts: 1,
    results: 20,
    costPerResult: 2.5,
    postReactions: 30,
    postComments: 4,
    rawPayload: null,
  };
}

test(
  "pg snapshots: append + latest-per-campaign + TIMESTAMPTZ/BIGINT fidelity",
  pgTestOptions,
  async () => {
    const db = await freshMigratedDb();
    try {
      const ids = await seedParents(db);
      const repo = new PgInsightSnapshotRepository(db);

      const capturedAt = new Date("2026-08-15T12:00:00.000Z");
      const appended = await repo.append({
        ...snapshotFor(ids.campaignAId, capturedAt, 5_000_000_000),
        rawPayload: { source: "pg-contract-test", nested: { ok: true } },
      });
      assert.match(appended.id, /^[0-9a-f-]{36}$/);
      // Older reading must never win the "latest" race.
      await repo.append(snapshotFor(ids.campaignAId, new Date(capturedAt.getTime() - 86_400_000), 1));

      const latest = await repo.findLatestForCampaign(ids.campaignAId);
      assert.ok(latest);
      assert.equal(latest.id, appended.id);
      // TIMESTAMPTZ preserves the instant exactly.
      assert.equal(latest.capturedAt.getTime(), capturedAt.getTime());
      // BIGINT > INT4 arrives as an exact JavaScript number.
      assert.equal(latest.impressions, 5_000_000_000);
      // NULL stays NULL; JSONB round-trips as a plain object.
      assert.equal(latest.reportingFrom, null);
      assert.deepEqual(latest.rawPayload, {
        source: "pg-contract-test",
        nested: { ok: true },
      });
    } finally {
      await db.close();
    }
  }
);

test(
  "pg snapshots: range filtering, pagination and campaign isolation",
  pgTestOptions,
  async () => {
    const db = await freshMigratedDb();
    try {
      const ids = await seedParents(db);
      const repo = new PgInsightSnapshotRepository(db);

      for (const day of [1, 2, 3]) {
        await repo.append(
          snapshotFor(ids.campaignAId, new Date(`2026-08-0${day}T00:00:00Z`), day * 100)
        );
      }

      const page1 = await repo.findRangeForCampaign(
        ids.campaignAId,
        new Date("2026-08-01T00:00:00Z"),
        new Date("2026-08-31T23:59:59Z"),
        { limit: 2 }
      );
      assert.equal(page1.items.length, 2);
      assert.equal(page1.items[0].impressions, 100); // ascending captured_at
      assert.equal(page1.nextCursor, "2");

      const page2 = await repo.findRangeForCampaign(
        ids.campaignAId,
        new Date("2026-08-01T00:00:00Z"),
        new Date("2026-08-31T23:59:59Z"),
        { limit: 2, cursor: page1.nextCursor! }
      );
      assert.equal(page2.items.length, 1);
      assert.equal(page2.items[0].impressions, 300);
      assert.equal(page2.nextCursor, null);

      // Outside the window -> nothing.
      const outside = await repo.findRangeForCampaign(
        ids.campaignAId,
        new Date("2027-01-01T00:00:00Z"),
        new Date("2027-01-31T00:00:00Z"),
        { limit: 10 }
      );
      assert.equal(outside.items.length, 0);

      // Latest per campaign across TWO campaigns, ordered by campaignId.
      await repo.append(snapshotFor(ids.campaignBId, new Date("2026-08-05T00:00:00Z"), 999));
      const latestBoth = await repo.findLatestForCampaigns(
        [ids.campaignBId, ids.campaignAId],
        new Date("2026-08-01T00:00:00Z"),
        new Date("2026-08-31T23:59:59Z")
      );
      assert.deepEqual(
        latestBoth.map((s) => s.campaignId),
        [ids.campaignAId, ids.campaignBId]
      );
      assert.equal(latestBoth[0].impressions, 300);
      assert.equal(latestBoth[1].impressions, 999);

      // Empty campaign list short-circuits to [] without invalid SQL.
      assert.deepEqual(
        await repo.findLatestForCampaigns([], new Date(), new Date()),
        []
      );
    } finally {
      await db.close();
    }
  }
);

test(
  "pg pricing rules: creation, ordering, effective dating, nullable components",
  pgTestOptions,
  async () => {
    const db = await freshMigratedDb();
    try {
      const ids = await seedParents(db);
      const repo = new PgPricingRuleRepository(db);

      assert.rejects(
        () =>
          repo.create({
            clientId: ids.clientId,
            metric: "spend",
            percentageMarkup: null,
            fixedMarkup: null,
            minimumCustomerValue: null,
            effectiveFrom: new Date("2026-01-01T00:00:00Z"),
          }),
        /at least one pricing component/
      );

      const older = await repo.create({
        clientId: ids.clientId,
        metric: "cpm",
        percentageMarkup: 0.1,
        fixedMarkup: null,
        minimumCustomerValue: null,
        effectiveFrom: new Date("2026-01-01T00:00:00Z"),
      });
      const newer = await repo.create({
        clientId: ids.clientId,
        metric: "cpm",
        percentageMarkup: null,
        fixedMarkup: 2.5,
        minimumCustomerValue: 10,
        effectiveFrom: new Date("2026-02-01T00:00:00Z"),
      });
      assert.notEqual(older.id, newer.id);

      const all = await repo.findByClient(ids.clientId);
      assert.deepEqual(
        all.map((r) => r.effectiveFrom.toISOString()),
        ["2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z"]
      );
      // Nullable DOUBLE PRECISION components survive as null.
      assert.equal(all[1].percentageMarkup, null);
      assert.equal(all[1].fixedMarkup, 2.5);
      assert.equal(all[1].minimumCustomerValue, 10);

      // Effective dating: before the first rule -> null; between rules ->
      // older applies; after the second -> newest wins.
      assert.equal(
        await repo.findApplicable(ids.clientId, "cpm", new Date("2025-12-31T00:00:00Z")),
        null
      );
      assert.equal(
        (
          await repo.findApplicable(ids.clientId, "cpm", new Date("2026-01-15T00:00:00Z"))
        )?.id,
        older.id
      );
      assert.equal(
        (
          await repo.findApplicable(ids.clientId, "cpm", new Date("2026-03-01T00:00:00Z"))
        )?.id,
        newer.id
      );
      // A metric with no rules at all is null, not an error.
      assert.equal(await repo.findApplicable(ids.clientId, "spend", new Date()), null);
    } finally {
      await db.close();
    }
  }
);

test(
  "pg dashboard preferences: JSONB round-trip, sanitization and find-then-write update",
  pgTestOptions,
  async () => {
    const db = await freshMigratedDb();
    try {
      const ids = await seedParents(db);
      const repo = new PgDashboardPreferenceRepository(db);

      assert.equal(await repo.findForClient(ids.clientId), null);
      assert.equal(await repo.findForUser(ids.adminUserId), null);

      // Invalid keys are sanitized away exactly like the SQLite path.
      // The cast mirrors the real boundary: the dashboard passes RAW
      // user-selected keys; sanitizeDashboardKpiKeys drops the junk.
      const saved = await repo.save({
        userId: null,
        clientId: ids.clientId,
        visibleMetrics: ["spend", "not-a-kpi", "ctr"] as DashboardKpiKey[],
        theme: "dark",
      });
      assert.deepEqual(saved.visibleMetrics, ["spend", "ctr"]);

      const reloaded = await repo.findForClient(ids.clientId);
      assert.ok(reloaded);
      assert.equal(reloaded.id, saved.id);
      assert.deepEqual(reloaded.visibleMetrics, ["spend", "ctr"]);
      assert.equal(reloaded.theme, "dark");

      // Find-then-write updates the SAME row (no ON CONFLICT insert).
      const updated = await repo.save({
        userId: null,
        clientId: ids.clientId,
        visibleMetrics: ["clicks"],
        theme: "system",
      });
      assert.equal(updated.id, saved.id);
      assert.ok(updated.updatedAt.getTime() >= saved.updatedAt.getTime());
      assert.deepEqual(
        (await repo.findForClient(ids.clientId))?.visibleMetrics,
        ["clicks"]
      );

      // The user-keyed path stores a SEPARATE row and never disturbs
      // the client preference.
      const userPref = await repo.save({
        userId: ids.adminUserId,
        clientId: null,
        visibleMetrics: ["reach", "frequency", "bogus"] as DashboardKpiKey[],
        theme: "light",
      });
      assert.deepEqual(userPref.visibleMetrics, ["reach", "frequency"]);
      assert.equal((await repo.findForUser(ids.adminUserId))?.id, userPref.id);
      assert.equal((await repo.findForClient(ids.clientId))?.id, saved.id);
    } finally {
      await db.close();
    }
  }
);

test(
  "pg admin assignments: assign/find/unassign and loud unique-pair violation",
  pgTestOptions,
  async () => {
    const db = await freshMigratedDb();
    try {
      const ids = await seedParents(db);
      const repo = new PgAdminAssignmentRepository(db);

      const assigned = await repo.assign(ids.adminUserId, ids.clientId);
      assert.match(assigned.id, /^[0-9a-f-]{36}$/);
      assert.ok(assigned.assignedAt instanceof Date);

      assert.equal((await repo.findByAdmin(ids.adminUserId)).length, 1);
      assert.equal((await repo.findByClient(ids.clientId)).length, 1);

      // Duplicate pair violates UNIQUE (admin_user_id, client_id) and
      // surfaces RAW — never silently swallowed.
      await assert.rejects(() => repo.assign(ids.adminUserId, ids.clientId));

      await repo.unassign(ids.adminUserId, ids.clientId);
      const remaining = await repo.findByAdmin(ids.adminUserId);
      assert.equal(remaining.length, 0);
    } finally {
      await db.close();
    }
  }
);

test(
  "pg driver facts relied on by the conversion layer: BOOLEAN is native",
  pgTestOptions,
  async () => {
    const db = await freshMigratedDb();
    try {
      const ids = await seedParents(db);
      // clients.is_active was seeded as `true` via parameter — pg must
      // deliver a REAL boolean back (the BOOLEAN mapping contract).
      const row = await db.queryOne<{ is_active: boolean }>(
        "SELECT is_active FROM clients WHERE id = $1",
        [ids.clientId]
      );
      assert.equal(typeof row?.is_active, "boolean");
      assert.equal(row?.is_active, true);
    } finally {
      await db.close();
    }
  }
);

// ---------------------------------------------------------------------------
// Wave 2 — User, Client, Package, AdAccount, Campaign, AuditLog, CollectorJob
// ---------------------------------------------------------------------------

test(
  "pg user: create, findById, findByEmail, update",
  pgTestOptions,
  async () => {
    const db = await freshMigratedDb();
    try {
      const repo = new PgUserRepository(db);

      const created = await repo.create({
        role: "admin",
        fullName: "PG Admin User",
        email: `pgadmin-${randomUUID()}@example.com`,
        clientId: null,
      });
      assert.match(created.id, /^[0-9a-f-]{36}$/);
      assert.ok(created.createdAt instanceof Date);
      assert.equal(created.clientId, null);

      const byId = await repo.findById(created.id);
      assert.ok(byId);
      assert.equal(byId.fullName, "PG Admin User");
      assert.equal(byId.role, "admin");

      const byEmail = await repo.findByEmail(created.email);
      assert.ok(byEmail);
      assert.equal(byEmail.id, created.id);

      const updated = await repo.update(created.id, { fullName: "Updated Admin" });
      assert.equal(updated.fullName, "Updated Admin");
      assert.equal(updated.id, created.id);

      assert.equal(await repo.findById(randomUUID()), null);
      assert.equal(await repo.findByEmail("no-such@example.com"), null);

      await assert.rejects(
        () => repo.update(randomUUID(), { fullName: "Ghost" }),
        /User not found/
      );
    } finally {
      await db.close();
    }
  }
);

test(
  "pg client: create, findById, findByIds, list pagination, update package reassignment, deactivate",
  pgTestOptions,
  async () => {
    const db = await freshMigratedDb();
    try {
      const ids = await seedParents(db);
      const repo = new PgClientRepository(db);

      // findById for the seeded client
      const found = await repo.findById(ids.clientId);
      assert.ok(found);
      assert.equal(found.id, ids.clientId);
      assert.equal(found.isActive, true);
      assert.ok(found.createdAt instanceof Date);
      // packageAssignedAt falls back to created_at for seed row (no package_assigned_at set)
      assert.ok(found.packageAssignedAt instanceof Date);

      // create a second package + second client
      const pkg2Id = randomUUID();
      await db.execute(
        `INSERT INTO packages (id, name, description, metric_thresholds, created_at,
           collection_frequency, default_visible_kpis, features, pricing_defaults)
         VALUES ($1, 'Pkg2', 'd', '{}', $2, 1, '[]', '{}', '{}')`,
        [pkg2Id, new Date()]
      );
      const c2 = await repo.create({
        name: "Second Client",
        businessType: "retail",
        contactEmail: `c2-${randomUUID()}@example.com`,
        packageId: ids.packageId,
        isActive: true,
      });
      assert.match(c2.id, /^[0-9a-f-]{36}$/);
      assert.ok(c2.packageAssignedAt instanceof Date);

      // findByIds
      const both = await repo.findByIds([ids.clientId, c2.id]);
      assert.equal(both.length, 2);
      assert.deepEqual(
        both.map((c) => c.id).sort(),
        [ids.clientId, c2.id].sort()
      );
      assert.deepEqual(await repo.findByIds([]), []);

      // list
      const page1 = await repo.list({ limit: 1 });
      assert.equal(page1.items.length, 1);
      assert.ok(page1.nextCursor !== null);
      const page2 = await repo.list({ limit: 10, cursor: page1.nextCursor! });
      assert.ok(page2.items.length >= 1);

      // update — package reassignment refreshes packageAssignedAt
      const before = c2.packageAssignedAt.getTime();
      const reassigned = await repo.update(c2.id, { packageId: pkg2Id });
      assert.equal(reassigned.packageId, pkg2Id);
      assert.ok(reassigned.packageAssignedAt.getTime() >= before);

      // non-package update preserves packageAssignedAt
      const nameOnly = await repo.update(c2.id, { name: "Renamed Client" });
      assert.equal(nameOnly.name, "Renamed Client");
      assert.equal(
        nameOnly.packageAssignedAt.getTime(),
        reassigned.packageAssignedAt.getTime()
      );

      // deactivate
      await repo.deactivate(c2.id);
      const deactivated = await repo.findById(c2.id);
      assert.equal(deactivated?.isActive, false);

      await assert.rejects(
        () => repo.update(randomUUID(), { name: "Ghost" }),
        /Client not found/
      );
    } finally {
      await db.close();
    }
  }
);

test(
  "pg package: create with validation, findById, findByCode, listAll, update",
  pgTestOptions,
  async () => {
    const db = await freshMigratedDb();
    try {
      const repo = new PgPackageRepository(db);

      // validation: missing code rejects
      await assert.rejects(
        () =>
          repo.create({
            name: "Bad",
            description: "d",
            code: null,
            collectionFrequency: 1,
            maxAdAccounts: null,
            maxCampaigns: null,
            retentionDays: null,
            defaultVisibleKpis: [],
            features: { charts: false, dataExport: false, advancedReporting: false },
            pricingDefaults: {},
            metricThresholds: {},
          }),
        /non-empty code/
      );

      const pkg = await repo.create({
        name: "Gold",
        description: "Gold plan",
        code: `gold-${randomUUID()}`,
        collectionFrequency: 12,
        maxAdAccounts: 5,
        maxCampaigns: 20,
        retentionDays: 90,
        defaultVisibleKpis: ["spend", "ctr"],
        features: { charts: true, dataExport: true, advancedReporting: false },
        pricingDefaults: {},
        metricThresholds: { ctr: 2.5 },
      });
      assert.match(pkg.id, /^[0-9a-f-]{36}$/);
      assert.ok(pkg.createdAt instanceof Date);
      // BIGINT nullable limits survive as exact numbers
      assert.equal(pkg.maxAdAccounts, 5);
      assert.equal(pkg.maxCampaigns, 20);
      assert.equal(pkg.retentionDays, 90);
      // JSONB round-trips
      assert.deepEqual(pkg.defaultVisibleKpis, ["spend", "ctr"]);
      assert.equal(pkg.features.charts, true);
      assert.deepEqual(pkg.metricThresholds, { ctr: 2.5 });

      // findById
      const byId = await repo.findById(pkg.id);
      assert.ok(byId);
      assert.equal(byId.collectionFrequency, 12);

      // findByCode
      const byCode = await repo.findByCode(pkg.code!);
      assert.equal(byCode?.id, pkg.id);
      assert.equal(await repo.findByCode("no-such-code"), null);

      // listAll ordering
      const all = await repo.listAll();
      assert.ok(all.length >= 2); // seeded package + new one
      assert.ok(all.every((p) => p.createdAt instanceof Date));

      // update
      const updated = await repo.update(pkg.id, {
        name: "Gold Plus",
        maxAdAccounts: null,
        features: { charts: true, dataExport: true, advancedReporting: true },
      });
      assert.equal(updated.name, "Gold Plus");
      assert.equal(updated.maxAdAccounts, null);
      assert.equal(updated.features.advancedReporting, true);

      await assert.rejects(
        () => repo.update(randomUUID(), { name: "Ghost" }),
        /Package not found/
      );
    } finally {
      await db.close();
    }
  }
);

test(
  "pg ad account: create, findById, findByClient, updateStatus, updateSource",
  pgTestOptions,
  async () => {
    const db = await freshMigratedDb();
    try {
      const ids = await seedParents(db);
      const repo = new PgAdAccountRepository(db);

      const created = await repo.create({
        clientId: ids.clientId,
        name: "Wave2 AdAccount",
        status: "pending",
        source: "playwright",
        metaAdAccountId: null,
      });
      assert.match(created.id, /^[0-9a-f-]{36}$/);
      assert.ok(created.createdAt instanceof Date);
      assert.equal(created.metaAdAccountId, null);

      const byId = await repo.findById(created.id);
      assert.ok(byId);
      assert.equal(byId.status, "pending");

      // findByClient includes both seeded and new
      const allForClient = await repo.findByClient(ids.clientId);
      assert.ok(allForClient.length >= 2);
      assert.ok(allForClient.some((a) => a.id === created.id));

      // updateStatus
      const statusUpdated = await repo.updateStatus(created.id, "connected");
      assert.equal(statusUpdated.status, "connected");

      // updateSource with metaAdAccountId
      const srcUpdated = await repo.updateSource(created.id, "meta_api", "act_123456");
      assert.equal(srcUpdated.source, "meta_api");
      assert.equal(srcUpdated.metaAdAccountId, "act_123456");

      // clear metaAdAccountId
      const cleared = await repo.updateSource(created.id, "playwright", null);
      assert.equal(cleared.metaAdAccountId, null);

      await assert.rejects(
        () => repo.updateStatus(randomUUID(), "connected"),
        /AdAccount not found/
      );
    } finally {
      await db.close();
    }
  }
);

test(
  "pg campaign: create, findById, findByAdAccount, findByAdAccountAndLabel, update",
  pgTestOptions,
  async () => {
    const db = await freshMigratedDb();
    try {
      const ids = await seedParents(db);
      const repo = new PgCampaignRepository(db);

      const created = await repo.create({
        adAccountId: ids.adAccountId,
        name: "Wave2 Campaign",
        objective: "REACH",
        status: "ACTIVE",
        scrapedLabel: "wave2-label",
        metaCampaignId: null,
      });
      assert.match(created.id, /^[0-9a-f-]{36}$/);
      assert.ok(created.createdAt instanceof Date);

      const byId = await repo.findById(created.id);
      assert.ok(byId);
      assert.equal(byId.scrapedLabel, "wave2-label");
      assert.equal(byId.metaCampaignId, null);

      // findByAdAccount includes seeded + new campaigns
      const all = await repo.findByAdAccount(ids.adAccountId);
      assert.ok(all.length >= 3); // 2 seeded + 1 new
      assert.ok(all.some((c) => c.id === created.id));

      // findByAdAccountAndLabel
      const byLabel = await repo.findByAdAccountAndLabel(ids.adAccountId, "wave2-label");
      assert.equal(byLabel?.id, created.id);
      assert.equal(
        await repo.findByAdAccountAndLabel(ids.adAccountId, "no-such-label"),
        null
      );

      // update
      const updated = await repo.update(created.id, {
        name: "Wave2 Renamed",
        status: "PAUSED",
        metaCampaignId: "meta-123",
      });
      assert.equal(updated.name, "Wave2 Renamed");
      assert.equal(updated.status, "PAUSED");
      assert.equal(updated.metaCampaignId, "meta-123");
      // unchanged fields preserved
      assert.equal(updated.scrapedLabel, "wave2-label");

      await assert.rejects(
        () => repo.update(randomUUID(), { name: "Ghost" }),
        /Campaign not found/
      );
    } finally {
      await db.close();
    }
  }
);

test(
  "pg audit log: append, findByTarget pagination, findByActor pagination, JSONB metadata",
  pgTestOptions,
  async () => {
    const db = await freshMigratedDb();
    try {
      const ids = await seedParents(db);
      const repo = new PgAuditLogRepository(db);

      // append with metadata
      const entry = await repo.append({
        actorUserId: ids.adminUserId,
        action: "package.assigned",
        targetEntityType: "client",
        targetEntityId: ids.clientId,
        metadata: { packageId: "pkg-123", previousPackageId: null },
      });
      assert.match(entry.id, /^[0-9a-f-]{36}$/);
      assert.ok(entry.createdAt instanceof Date);
      assert.deepEqual(entry.metadata, {
        packageId: "pkg-123",
        previousPackageId: null,
      });

      // append with null metadata
      const noMeta = await repo.append({
        actorUserId: ids.adminUserId,
        action: "client.deactivated",
        targetEntityType: "client",
        targetEntityId: ids.clientId,
        metadata: null,
      });
      assert.equal(noMeta.metadata, null);

      // append a third entry for pagination testing
      await repo.append({
        actorUserId: ids.adminUserId,
        action: "ad_account.created",
        targetEntityType: "ad_account",
        targetEntityId: ids.adAccountId,
        metadata: null,
      });

      // findByTarget: two entries for the client, newest first
      const targetPage1 = await repo.findByTarget("client", ids.clientId, { limit: 1 });
      assert.equal(targetPage1.items.length, 1);
      assert.ok(targetPage1.nextCursor !== null);
      const targetPage2 = await repo.findByTarget("client", ids.clientId, {
        limit: 10,
        cursor: targetPage1.nextCursor!,
      });
      assert.equal(targetPage2.items.length, 1);
      assert.equal(targetPage2.nextCursor, null);
      // DESC order: most recent first
      assert.ok(
        targetPage1.items[0].createdAt.getTime() >=
          targetPage2.items[0].createdAt.getTime()
      );

      // findByActor: all three entries for adminUserId
      const actorPage = await repo.findByActor(ids.adminUserId, { limit: 10 });
      assert.equal(actorPage.items.length, 3);
      assert.equal(actorPage.nextCursor, null);

      // isolation: different target type returns nothing
      const empty = await repo.findByTarget("package", ids.clientId, { limit: 10 });
      assert.equal(empty.items.length, 0);
    } finally {
      await db.close();
    }
  }
);

test(
  "pg collector job: start, findById, findLatestForAdAccount, complete success/failure",
  pgTestOptions,
  async () => {
    const db = await freshMigratedDb();
    try {
      const ids = await seedParents(db);
      const repo = new PgCollectorJobRepository(db);

      assert.equal(await repo.findLatestForAdAccount(ids.adAccountId), null);

      const job = await repo.start(ids.adAccountId, "playwright");
      assert.match(job.id, /^[0-9a-f-]{36}$/);
      assert.equal(job.status, "running");
      assert.equal(job.finishedAt, null);
      assert.equal(job.errorMessage, null);
      assert.ok(job.startedAt instanceof Date);

      const byId = await repo.findById(job.id);
      assert.ok(byId);
      assert.equal(byId.status, "running");

      // complete successfully
      const done = await repo.complete(job.id, "success");
      assert.equal(done.status, "success");
      assert.ok(done.finishedAt instanceof Date);
      assert.equal(done.errorMessage, null);

      // second job for the same ad account
      const job2 = await repo.start(ids.adAccountId, "playwright");
      const failed = await repo.complete(job2.id, "failed", "network timeout");
      assert.equal(failed.status, "failed");
      assert.equal(failed.errorMessage, "network timeout");

      // findLatestForAdAccount returns the most recent (job2)
      const latest = await repo.findLatestForAdAccount(ids.adAccountId);
      assert.ok(latest);
      assert.equal(latest.id, job2.id);

      await assert.rejects(
        () => repo.complete(randomUUID(), "success"),
        /CollectorJob not found/
      );
    } finally {
      await db.close();
    }
  }
);
