import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createRepositories,
  openDatabase,
  runMigrations,
  SqliteAdAccountRepository,
  SqliteAdminAssignmentRepository,
  SqliteAuditLogRepository,
  SqliteClientRepository,
  SqlitePackageRepository,
  SqliteUserRepository,
} from "@repo/database";
import type { UserRole } from "@repo/shared";
import {
  canManageCampaignOwnership,
  getCampaignAdminData,
  runAssignCampaignToClient,
  runDeactivateCampaignAssignment,
  type CampaignAdminEntry,
} from "@/lib/campaign-admin";
import { getEffectiveClientIdForCampaign } from "@/lib/campaign-ownership";
import { CampaignOwnershipList } from "@/components/admin/campaign-ownership-list";
import { AUDIT_ACTIONS } from "@/lib/audit";

type Db = ReturnType<typeof openDatabase>;

function createTestDb(): Db {
  const db = openDatabase(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

async function createPackage(db: Db, code: string, name: string) {
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
  });
}

async function createClient(db: Db, packageId: string, name: string) {
  const suffix = Math.random().toString(36).slice(2);
  return new SqliteClientRepository(db).create({
    name,
    businessType: "E-commerce",
    contactEmail: `client-${suffix}@example.com`,
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

async function createAdAccount(db: Db, clientId: string, name: string) {
  return new SqliteAdAccountRepository(db).create({
    clientId,
    name,
    status: "pending",
    source: "playwright",
    metaAdAccountId: null,
  });
}

async function createCampaign(db: Db, adAccountId: string, name: string) {
  return createRepositories(db).campaignRepository.create({
    adAccountId,
    name,
    objective: "OUTCOME_TRAFFIC",
    status: "active",
    scrapedLabel: null,
    metaCampaignId: null,
  });
}

function actor(user: { id: string; role: UserRole; clientId: string | null }) {
  return { role: user.role, id: user.id, clientId: user.clientId };
}

test("campaign admin: only admin and super_admin may manage ownership", () => {
  assert.equal(canManageCampaignOwnership({ role: "super_admin" }), true);
  assert.equal(canManageCampaignOwnership({ role: "admin" }), true);
  assert.equal(canManageCampaignOwnership({ role: "client" }), false);
  assert.equal(canManageCampaignOwnership(null), false);
});

test("campaign admin: super_admin sees all clients, admin only assigned ones", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold");
  const assigned = await createClient(db, pkg.id, "Assigned");
  await createClient(db, pkg.id, "Other");
  const admin = await createUser(db, "admin");
  await new SqliteAdminAssignmentRepository(db).assign(admin.id, assigned.id);

  const superView = await getCampaignAdminData(
    actor(await createUser(db, "super_admin")),
    null,
    db
  );
  assert.equal(superView.clients.length, 2);

  const adminView = await getCampaignAdminData(actor(admin), null, db);
  assert.deepEqual(
    adminView.clients.map((client) => client.id),
    [assigned.id]
  );
  assert.equal(adminView.selectedClientId, null);
  assert.equal(adminView.campaigns.length, 0);

  db.close();
});

test("campaign admin: an inaccessible requested clientId is ignored", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold");
  const assigned = await createClient(db, pkg.id, "Assigned");
  const other = await createClient(db, pkg.id, "Other");
  const admin = await createUser(db, "admin");
  await new SqliteAdminAssignmentRepository(db).assign(admin.id, assigned.id);

  const view = await getCampaignAdminData(actor(admin), other.id, db);
  assert.equal(view.selectedClientId, null);
  assert.equal(view.campaigns.length, 0);

  db.close();
});

test("campaign admin: assignment overrides inherited ownership and is audited", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold");
  const owner = await createClient(db, pkg.id, "Owner");
  const target = await createClient(db, pkg.id, "Target");
  const superUser = await createUser(db, "super_admin");
  const account = await createAdAccount(db, owner.id, "Owner Account");
  const campaign = await createCampaign(db, account.id, "Campaign A");
  const repos = createRepositories(db);

  assert.equal(await getEffectiveClientIdForCampaign(campaign.id, db), owner.id);

  const outcome = await runAssignCampaignToClient(
    actor(superUser),
    campaign.id,
    target.id,
    db
  );
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.value.clientId, target.id);
  assert.equal(outcome.value.changed, false);
  assert.equal(outcome.value.previousClientId, null);

  assert.equal(await getEffectiveClientIdForCampaign(campaign.id, db), target.id);
  assert.ok(
    (await repos.campaignRepository.findByClient(target.id)).some(
      (entry) => entry.id === campaign.id
    )
  );
  assert.ok(
    !(await repos.campaignRepository.findByClient(owner.id)).some(
      (entry) => entry.id === campaign.id
    )
  );

  const { items } = await new SqliteAuditLogRepository(db).findByTarget(
    "campaign",
    campaign.id,
    { limit: 10 }
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].action, AUDIT_ACTIONS.CAMPAIGN_ASSIGNED);
  assert.deepEqual(items[0].metadata, { clientId: target.id });

  db.close();
});

test("campaign admin: reassignment records a change and keeps one active row", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold");
  const owner = await createClient(db, pkg.id, "Owner");
  const target = await createClient(db, pkg.id, "Target");
  const superUser = await createUser(db, "super_admin");
  const account = await createAdAccount(db, owner.id, "Owner Account");
  const campaign = await createCampaign(db, account.id, "Campaign B");
  const repos = createRepositories(db);

  const first = await runAssignCampaignToClient(
    actor(superUser),
    campaign.id,
    target.id,
    db
  );
  assert.equal(first.ok, true);

  const second = await runAssignCampaignToClient(
    actor(superUser),
    campaign.id,
    owner.id,
    db
  );
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.value.changed, true);
  assert.equal(second.value.previousClientId, target.id);

  const active = await repos.campaignAssignmentRepository.findActiveByCampaign(
    campaign.id
  );
  assert.equal(active?.clientId, owner.id);
  assert.equal(
    (await repos.campaignAssignmentRepository.findActiveByClient(target.id)).length,
    0
  );
  assert.equal(
    (await repos.campaignAssignmentRepository.findActiveByClient(owner.id)).length,
    1
  );

  const { items } = await new SqliteAuditLogRepository(db).findByTarget(
    "campaign",
    campaign.id,
    { limit: 10 }
  );
  const changed = items.find(
    (entry) => entry.action === AUDIT_ACTIONS.CAMPAIGN_ASSIGNMENT_CHANGED
  );
  assert.ok(changed);
  assert.deepEqual(changed?.metadata, {
    previousClientId: target.id,
    clientId: owner.id,
  });

  db.close();
});

test("campaign admin: assigning the same client twice is a controlled error", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold");
  const owner = await createClient(db, pkg.id, "Owner");
  const target = await createClient(db, pkg.id, "Target");
  const superUser = await createUser(db, "super_admin");
  const account = await createAdAccount(db, owner.id, "Owner Account");
  const campaign = await createCampaign(db, account.id, "Campaign C");

  const first = await runAssignCampaignToClient(
    actor(superUser),
    campaign.id,
    target.id,
    db
  );
  assert.equal(first.ok, true);

  const again = await runAssignCampaignToClient(
    actor(superUser),
    campaign.id,
    target.id,
    db
  );
  assert.equal(again.ok, false);
  if (again.ok) return;
  assert.match(again.error, /قبل/);

  const active = await createRepositories(
    db
  ).campaignAssignmentRepository.findActiveByCampaign(campaign.id);
  assert.equal(active?.clientId, target.id);

  db.close();
});

test("campaign admin: admin cannot move a campaign into an unassigned client", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold");
  const assigned = await createClient(db, pkg.id, "Assigned");
  const other = await createClient(db, pkg.id, "Other");
  const admin = await createUser(db, "admin");
  await new SqliteAdminAssignmentRepository(db).assign(admin.id, assigned.id);
  const account = await createAdAccount(db, assigned.id, "Assigned Account");
  const campaign = await createCampaign(db, account.id, "Campaign D");

  const outcome = await runAssignCampaignToClient(
    actor(admin),
    campaign.id,
    other.id,
    db
  );
  assert.equal(outcome.ok, false);
  if (outcome.ok) return;
  assert.match(outcome.error, /اجازه/);

  const active = await createRepositories(
    db
  ).campaignAssignmentRepository.findActiveByCampaign(campaign.id);
  assert.equal(active, null);

  db.close();
});

test("campaign admin: admin cannot touch a campaign owned by an unassigned client", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold");
  const assigned = await createClient(db, pkg.id, "Assigned");
  const other = await createClient(db, pkg.id, "Other");
  const admin = await createUser(db, "admin");
  await new SqliteAdminAssignmentRepository(db).assign(admin.id, assigned.id);
  const otherAccount = await createAdAccount(db, other.id, "Other Account");
  const campaign = await createCampaign(db, otherAccount.id, "Campaign E");

  const outcome = await runAssignCampaignToClient(
    actor(admin),
    campaign.id,
    assigned.id,
    db
  );
  assert.equal(outcome.ok, false);
  if (outcome.ok) return;
  assert.match(outcome.error, /اجازه/);

  db.close();
});

test("campaign admin: a client user can never mutate ownership", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold");
  const owner = await createClient(db, pkg.id, "Owner");
  const clientUser = await createUser(db, "client", owner.id);
  const account = await createAdAccount(db, owner.id, "Owner Account");
  const campaign = await createCampaign(db, account.id, "Campaign F");

  const assign = await runAssignCampaignToClient(
    actor(clientUser),
    campaign.id,
    owner.id,
    db
  );
  assert.equal(assign.ok, false);
  if (!assign.ok) assert.match(assign.error, /مدیر/);

  const deactivate = await runDeactivateCampaignAssignment(
    actor(clientUser),
    campaign.id,
    db
  );
  assert.equal(deactivate.ok, false);

  db.close();
});

test("campaign admin: deactivation restores inherited ownership and is audited", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold");
  const owner = await createClient(db, pkg.id, "Owner");
  const target = await createClient(db, pkg.id, "Target");
  const superUser = await createUser(db, "super_admin");
  const account = await createAdAccount(db, owner.id, "Owner Account");
  const campaign = await createCampaign(db, account.id, "Campaign G");

  await runAssignCampaignToClient(actor(superUser), campaign.id, target.id, db);

  const outcome = await runDeactivateCampaignAssignment(
    actor(superUser),
    campaign.id,
    db
  );
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.value.clientId, target.id);

  assert.equal(await getEffectiveClientIdForCampaign(campaign.id, db), owner.id);
  assert.equal(
    await createRepositories(db).campaignAssignmentRepository.findActiveByCampaign(
      campaign.id
    ),
    null
  );

  const { items } = await new SqliteAuditLogRepository(db).findByTarget(
    "campaign",
    campaign.id,
    { limit: 10 }
  );
  const deactivated = items.find(
    (entry) => entry.action === AUDIT_ACTIONS.CAMPAIGN_ASSIGNMENT_DEACTIVATED
  );
  assert.ok(deactivated);
  assert.deepEqual(deactivated?.metadata, { clientId: target.id });

  const again = await runDeactivateCampaignAssignment(
    actor(superUser),
    campaign.id,
    db
  );
  assert.equal(again.ok, false);
  if (again.ok) return;
  assert.match(again.error, /انتساب فعال/);

  const after = await new SqliteAuditLogRepository(db).findByTarget(
    "campaign",
    campaign.id,
    { limit: 10 }
  );
  assert.equal(
    after.items.filter(
      (entry) => entry.action === AUDIT_ACTIONS.CAMPAIGN_ASSIGNMENT_DEACTIVATED
    ).length,
    1
  );

  db.close();
});

test("campaign admin: the page data marks explicit vs inherited ownership", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold");
  const owner = await createClient(db, pkg.id, "Owner");
  const target = await createClient(db, pkg.id, "Target");
  const superUser = await createUser(db, "super_admin");
  const account = await createAdAccount(db, owner.id, "Owner Account");
  const campaign = await createCampaign(db, account.id, "Campaign H");

  const before = await getCampaignAdminData(actor(superUser), owner.id, db);
  assert.equal(before.selectedClientId, owner.id);
  assert.equal(before.campaigns.length, 1);
  assert.equal(before.campaigns[0].ownership, "inherited");
  assert.equal(before.campaigns[0].effectiveClientId, owner.id);
  assert.equal(before.campaigns[0].activeAssignment, null);

  await runAssignCampaignToClient(actor(superUser), campaign.id, target.id, db);

  const after = await getCampaignAdminData(actor(superUser), target.id, db);
  assert.equal(after.campaigns.length, 1);
  assert.equal(after.campaigns[0].ownership, "assigned");
  assert.equal(after.campaigns[0].effectiveClientId, target.id);
  assert.equal(after.campaigns[0].effectiveClientName, "Target");
  assert.equal(after.campaigns[0].inheritedClientId, owner.id);
  assert.equal(after.campaigns[0].activeAssignment?.clientId, target.id);

  db.close();
});

test("campaign admin: the ownership list renders owner, source and controls", () => {
  const entries: CampaignAdminEntry[] = [
    {
      id: "c1",
      name: "Campaign One",
      status: "active",
      adAccountId: "a1",
      adAccountName: "Account One",
      inheritedClientId: "cl1",
      inheritedClientName: "Owner Client",
      activeAssignment: null,
      effectiveClientId: "cl1",
      effectiveClientName: "Owner Client",
      ownership: "inherited",
    },
    {
      id: "c2",
      name: "Campaign Two",
      status: "active",
      adAccountId: "a2",
      adAccountName: "Account Two",
      inheritedClientId: "cl1",
      inheritedClientName: "Owner Client",
      activeAssignment: {
        id: "as1",
        clientId: "cl2",
        clientName: "Target Client",
        assignedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      effectiveClientId: "cl2",
      effectiveClientName: "Target Client",
      ownership: "assigned",
    },
  ];

  const html = renderToStaticMarkup(
    <CampaignOwnershipList
      campaigns={entries}
      clients={[
        { id: "cl1", name: "Owner Client" },
        { id: "cl2", name: "Target Client" },
      ]}
    />
  );

  assert.ok(html.includes("Campaign One"));
  assert.ok(html.includes("Campaign Two"));
  assert.ok(html.includes("Owner Client"));
  assert.ok(html.includes("Target Client"));
  assert.ok(html.includes("از اکانت تبلیغاتی"));
  assert.ok(html.includes("انتساب صریح"));
  assert.ok(html.includes("لغو انتساب"));

  const empty = renderToStaticMarkup(
    <CampaignOwnershipList campaigns={[]} clients={[]} />
  );
  assert.ok(empty.includes("کمپینی برای نمایش وجود ندارد."));
});

test("campaign admin: the feature never imports a storage engine or raw SQL", () => {
  const files = [
    new URL("../lib/campaign-admin.ts", import.meta.url),
    new URL("../app/(dashboard)/admin/campaigns/actions.ts", import.meta.url),
    new URL("../app/(dashboard)/admin/campaigns/page.tsx", import.meta.url),
    new URL(
      "../components/admin/campaign-ownership-management.tsx",
      import.meta.url
    ),
    new URL(
      "../components/admin/campaign-ownership-list.tsx",
      import.meta.url
    ),
  ];
  const forbidden: RegExp[] = [
    /\bSqlite[A-Za-z]*Repository\b/,
    /\bPg[A-Za-z]*Repository\b/,
    /DATABASE_PROVIDER/,
    /\bSELECT\b/,
    /\bINSERT\s+INTO\b/,
    /\bUPDATE\s+\w+\s+SET\b/,
    /\bDELETE\s+FROM\b/,
  ];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const pattern of forbidden) {
      assert.ok(
        !pattern.test(source),
        `${file.pathname} matches forbidden pattern ${pattern}`
      );
    }
  }
});