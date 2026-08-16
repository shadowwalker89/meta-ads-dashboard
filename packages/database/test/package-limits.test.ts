import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { runMigrations } from "../src/migrations/migrate.js";
import { SqlitePackageEnforcement } from "../src/services/package-enforcement.js";
import {
  SqliteAdAccountRepository,
  SqliteCampaignRepository,
  SqliteClientRepository,
  SqlitePackageRepository,
} from "../src/repositories/index.js";
import { canUserConfigureClientKpis } from "@repo/shared";

/** Fresh in-memory DB for each test. */
function db0() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

/**
 * A shared package per DB keeps each test self-contained while still
 * exercising real package rows (unique idx_packages_code). The defaults
 * are the unlimited baseline; individual tests override the limit under
 * test.
 */
async function seedClient(
  db: Database.Database,
  overrides: Partial<{ maxAdAccounts: number | null; maxCampaigns: number | null }> = {}
) {
  const packages = new SqlitePackageRepository(db);
  const pkg = await packages.create({
    name: "Gold",
    description: "Gold plan",
    code: "gold",
    collectionFrequency: 12,
    maxAdAccounts: overrides.maxAdAccounts ?? null,
    maxCampaigns: overrides.maxCampaigns ?? null,
    retentionDays: null,
    defaultVisibleKpis: [],
    features: { charts: false, dataExport: false, advancedReporting: false },
    pricingDefaults: {},
    metricThresholds: {},
  });

  const clients = new SqliteClientRepository(db);
  const client = await clients.create({
    name: "Test Client",
    businessType: "E-commerce",
    contactEmail: "client@example.com",
    packageId: pkg.id,
    isActive: true,
  });

  return { db, pkg, client };
}

async function createAdAccount(db: Database.Database, clientId: string, name: string) {
  return new SqliteAdAccountRepository(db).create({
    clientId,
    name,
    status: "connected",
    source: "playwright",
    metaAdAccountId: null,
  });
}

async function createCampaign(
  db: Database.Database,
  adAccountId: string,
  name: string
) {
  return new SqliteCampaignRepository(db).create({
    adAccountId,
    name,
    objective: "unknown",
    status: "unknown",
    scrapedLabel: name,
    metaCampaignId: null,
  });
}

// --- Test 1: below-limit creation is allowed ---------------------------

test("package limits: ad account creation is allowed below the limit", async () => {
  const { db, client } = await seedClient(db0(), { maxAdAccounts: 3 });
  const enforcement = new SqlitePackageEnforcement(db);

  await createAdAccount(db, client.id, "Account 1");
  await enforcement.assertCanCreateAdAccount(client.id); // count = 1 < 3

  db.close();
});

// --- Test 2: at-limit ad account creation is rejected ------------------

test("package limits: ad account creation is rejected at the limit", async () => {
  const { db, client } = await seedClient(db0(), { maxAdAccounts: 2 });
  const enforcement = new SqlitePackageEnforcement(db);

  await createAdAccount(db, client.id, "Account 1");
  await createAdAccount(db, client.id, "Account 2");

  await assert.rejects(
    enforcement.assertCanCreateAdAccount(client.id),
    /maximum number of ad accounts \(2\)/
  );

  db.close();
});

// --- Test 3: below-limit campaign creation is allowed ------------------

test("package limits: campaign creation is allowed below the limit", async () => {
  const { db, client } = await seedClient(db0(), { maxCampaigns: 5 });
  const enforcement = new SqlitePackageEnforcement(db);

  const adAccount = await createAdAccount(db, client.id, "Account 1");
  await createCampaign(db, adAccount.id, "Campaign A");
  await enforcement.assertCanCreateCampaign(client.id); // count = 1 < 5

  db.close();
});

// --- Test 4: at-limit campaign creation is rejected --------------------

test("package limits: campaign creation is rejected at the limit", async () => {
  const { db, client } = await seedClient(db0(), { maxCampaigns: 2 });
  const enforcement = new SqlitePackageEnforcement(db);

  const adAccount = await createAdAccount(db, client.id, "Account 1");
  await createCampaign(db, adAccount.id, "Campaign A");
  await createCampaign(db, adAccount.id, "Campaign B");

  await assert.rejects(
    enforcement.assertCanCreateCampaign(client.id),
    /maximum number of campaigns \(2\)/
  );

  db.close();
});

// --- Test 5: null limit means unlimited --------------------------------

test("package limits: null limit is unlimited for both resources", async () => {
  const { db, client } = await seedClient(db0());
  const enforcement = new SqlitePackageEnforcement(db);

  for (let i = 0; i < 5; i++) {
    await createAdAccount(db, client.id, `Account ${i}`);
  }
  const adAccounts = await new SqliteAdAccountRepository(db).findByClient(client.id);
  assert.equal(adAccounts.length, 5);

  const adAccount = adAccounts[0];
  for (let i = 0; i < 7; i++) {
    await createCampaign(db, adAccount.id, `Campaign ${i}`);
  }

  await enforcement.assertCanCreateAdAccount(client.id);
  await enforcement.assertCanCreateCampaign(client.id);

  db.close();
});

// --- Test 6: campaign count spans all ad accounts of the client --------

test("package limits: campaign limit spans all ad accounts of the client", async () => {
  const { db, client } = await seedClient(db0(), { maxCampaigns: 3 });
  const enforcement = new SqlitePackageEnforcement(db);

  const accountA = await createAdAccount(db, client.id, "Account A");
  const accountB = await createAdAccount(db, client.id, "Account B");
  await createCampaign(db, accountA.id, "Campaign 1");
  await createCampaign(db, accountA.id, "Campaign 2");
  await createCampaign(db, accountB.id, "Campaign 3");

  await assert.rejects(
    enforcement.assertCanCreateCampaign(client.id),
    /maximum number of campaigns \(3\)/
  );

  db.close();
});

// --- Test 7: updating an existing record consumes no new slot ----------

test("package limits: updating an existing record does not consume a new slot", async () => {
  const { db, client } = await seedClient(db0(), {
    maxAdAccounts: 1,
    maxCampaigns: 2,
  });
  const enforcement = new SqlitePackageEnforcement(db);
  const campaigns = new SqliteCampaignRepository(db);

  const adAccount = await createAdAccount(db, client.id, "Account 1");
  const campaignA = await createCampaign(db, adAccount.id, "Campaign A");
  const campaignB = await createCampaign(db, adAccount.id, "Campaign B");

  // Updating must never re-check a slot: both resources are already at
  // their limit, so any update that threw would falsely revoke existing
  // records that were legitimately created.
  await campaigns.update(campaignA.id, { name: "Campaign A (renamed)" });
  await campaigns.update(campaignB.id, { status: "active" });

  // The stored count is unchanged, so the limit is still enforced:
  await assert.rejects(
    enforcement.assertCanCreateCampaign(client.id),
    /maximum number of campaigns \(2\)/
  );
  await assert.rejects(
    enforcement.assertCanCreateAdAccount(client.id),
    /maximum number of ad accounts \(1\)/
  );

  db.close();
});

// --- Test 8: authorization stays orthogonal to package limits ----------

test("package limits: authorization and limits are enforced independently", async () => {
  const { db, client } = await seedClient(db0(), { maxCampaigns: 1 });
  const enforcement = new SqlitePackageEnforcement(db);

  const adAccount = await createAdAccount(db, client.id, "Account 1");
  await createCampaign(db, adAccount.id, "Campaign A");

  // The existing auth rule is unaffected: a client user may never
  // configure KPIs, regardless of any package setting.
  assert.equal(
    canUserConfigureClientKpis({ role: "client" }, client.id, []),
    false
  );
  assert.equal(
    canUserConfigureClientKpis({ role: "admin" }, client.id, [client.id]),
    true
  );

  // Package limits are enforced on the business layer, independent of
  // who is calling — the service carries no auth context.
  await assert.rejects(
    enforcement.assertCanCreateCampaign(client.id),
    /maximum number of campaigns \(1\)/
  );

  db.close();
});