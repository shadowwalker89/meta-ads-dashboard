import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import {
  openDatabase,
  runMigrations,
  SqliteAdAccountRepository,
  SqliteAdminAssignmentRepository,
  SqliteAuditLogRepository,
  SqliteClientRepository,
  SqlitePackageRepository,
  SqliteUserRepository,
} from "@repo/database";
import type { Package, UserRole } from "@repo/shared";
import {
  canCreateClients,
  canManageClients,
  getAdAccountAdminData,
  getClientAdminData,
  runCreateAdAccount,
  runCreateClient,
  runDeactivateClient,
  runUpdateAdAccountSource,
  runUpdateAdAccountStatus,
} from "@/lib/client-admin";
import { ClientList } from "@/components/admin/client-list";
import { AUDIT_ACTIONS } from "@/lib/audit";

function createTestDb() {
  const db = openDatabase(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

async function createPackage(
  db: ReturnType<typeof openDatabase>,
  code: string,
  name: string,
  overrides: Partial<Omit<Package, "id" | "createdAt">> = {}
) {
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
    ...overrides,
  });
}

async function createClient(
  db: ReturnType<typeof openDatabase>,
  packageId: string,
  name = "Client One"
) {
  return new SqliteClientRepository(db).create({
    name,
    businessType: "E-commerce",
    contactEmail: "client@example.com",
    packageId,
    isActive: true,
  });
}

async function createUser(
  db: ReturnType<typeof openDatabase>,
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

// --- 1. Authorization gates -----------------------------------------------

test("client admin: viewing/managing clients requires admin or super_admin", () => {
  assert.equal(canManageClients({ role: "super_admin" }), true);
  assert.equal(canManageClients({ role: "admin" }), true);
  assert.equal(canManageClients({ role: "client" }), false);
  assert.equal(canManageClients(null), false);
});

test("client admin: creating/deactivating clients is super_admin only", () => {
  assert.equal(canCreateClients({ role: "super_admin" }), true);
  assert.equal(canCreateClients({ role: "admin" }), false);
  assert.equal(canCreateClients({ role: "client" }), false);
  assert.equal(canCreateClients(null), false);
});

// --- 2. Data loader: super_admin sees all clients -------------------------

test("client admin: super_admin client list includes package names and counts", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold");
  const client = await createClient(db, pkg.id, "Acme");
  await new SqliteAdAccountRepository(db).create({
    clientId: client.id,
    name: "Acme Account",
    status: "pending",
    source: "playwright",
    metaAdAccountId: null,
  });
  const superUser = await createUser(db, "super_admin");

  const { clients, packages } = await getClientAdminData(actor(superUser), db);
  assert.ok(clients.some((c) => c.id === client.id));
  const entry = clients.find((c) => c.id === client.id);
  assert.equal(entry?.packageName, "Gold");
  assert.equal(entry?.adAccountCount, 1);
  assert.equal(entry?.isActive, true);
  assert.equal(packages.length, 1);

  db.close();
});

// --- 3. Data loader: admin sees only assigned clients ---------------------

test("client admin: admin sees only their assigned clients", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold");
  const assignedClient = await createClient(db, pkg.id, "Assigned");
  const otherClient = await createClient(db, pkg.id, "Other");
  const admin = await createUser(db, "admin");
  await new SqliteAdminAssignmentRepository(db).assign(admin.id, assignedClient.id);

  const { clients } = await getClientAdminData(actor(admin), db);
  const ids = clients.map((c) => c.id);
  assert.ok(ids.includes(assignedClient.id));
  assert.ok(!ids.includes(otherClient.id));

  db.close();
});

// --- 4. Client creation ---------------------------------------------------

test("client admin: super_admin can create a client (audited)", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold");
  const superUser = await createUser(db, "super_admin");

  const outcome = await runCreateClient(
    actor(superUser),
    { name: "New Client", businessType: "Retail", contactEmail: "new@example.com", packageId: pkg.id },
    db
  );
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;

  const saved = await new SqliteClientRepository(db).findById(outcome.value.id);
  assert.equal(saved?.name, "New Client");
  assert.equal(saved?.isActive, true);

  const { items } = await new SqliteAuditLogRepository(db).findByTarget(
    "client",
    outcome.value.id,
    { limit: 10 }
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].action, AUDIT_ACTIONS.CLIENT_CREATED);
  assert.deepEqual(items[0].metadata, { name: "New Client", packageId: pkg.id });

  db.close();
});

test("client admin: admin cannot create clients", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold");
  const admin = await createUser(db, "admin");

  const outcome = await runCreateClient(
    actor(admin),
    { name: "Nope", businessType: "Retail", contactEmail: "nope@example.com", packageId: pkg.id },
    db
  );
  assert.equal(outcome.ok, false);

  const rows = (await new SqliteClientRepository(db).list({ limit: 100 })).items;
  assert.equal(rows.length, 0);

  db.close();
});

// --- 5. Client deactivation -----------------------------------------------

test("client admin: super_admin can deactivate a client (audited)", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold");
  const client = await createClient(db, pkg.id, "Acme");
  const superUser = await createUser(db, "super_admin");

  const outcome = await runDeactivateClient(actor(superUser), client.id, db);
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;

  const saved = await new SqliteClientRepository(db).findById(client.id);
  assert.equal(saved?.isActive, false);

  const { items } = await new SqliteAuditLogRepository(db).findByTarget(
    "client",
    client.id,
    { limit: 10 }
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].action, AUDIT_ACTIONS.CLIENT_DEACTIVATED);
  assert.deepEqual(items[0].metadata, { name: "Acme" });

  // Deactivating again is a no-op rejection (no duplicate audit).
  const again = await runDeactivateClient(actor(superUser), client.id, db);
  assert.equal(again.ok, false);
  const after = await new SqliteAuditLogRepository(db).findByTarget("client", client.id, {
    limit: 10,
  });
  assert.equal(after.items.length, 1);

  db.close();
});

test("client admin: admin cannot deactivate clients", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold");
  const client = await createClient(db, pkg.id, "Acme");
  const admin = await createUser(db, "admin");

  const outcome = await runDeactivateClient(actor(admin), client.id, db);
  assert.equal(outcome.ok, false);

  const saved = await new SqliteClientRepository(db).findById(client.id);
  assert.equal(saved?.isActive, true);

  db.close();
});

// --- 6. AdAccount creation + package limit enforcement --------------------

test("client admin: ad account creation honors Package.maxAdAccounts", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold", { maxAdAccounts: 1 });
  const client = await createClient(db, pkg.id, "Acme");
  const superUser = await createUser(db, "super_admin");

  const first = await runCreateAdAccount(
    actor(superUser),
    { clientId: client.id, name: "One", status: "pending", source: "playwright", metaAdAccountId: null },
    db
  );
  assert.equal(first.ok, true);

  const second = await runCreateAdAccount(
    actor(superUser),
    { clientId: client.id, name: "Two", status: "pending", source: "playwright", metaAdAccountId: null },
    db
  );
  assert.equal(second.ok, false);
  assert.ok(second.ok || second.error.includes("maximum number of ad accounts"));

  const accounts = await new SqliteAdAccountRepository(db).findByClient(client.id);
  assert.equal(accounts.length, 1);

  db.close();
});

test("client admin: ad account creation is audited", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold");
  const client = await createClient(db, pkg.id, "Acme");
  const superUser = await createUser(db, "super_admin");

  const outcome = await runCreateAdAccount(
    actor(superUser),
    { clientId: client.id, name: "Acme Account", status: "pending", source: "playwright", metaAdAccountId: "2001" },
    db
  );
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;

  const { items } = await new SqliteAuditLogRepository(db).findByTarget(
    "ad_account",
    outcome.value.id,
    { limit: 10 }
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].action, AUDIT_ACTIONS.AD_ACCOUNT_CREATED);
  assert.deepEqual(items[0].metadata, {
    clientId: client.id,
    name: "Acme Account",
    source: "playwright",
  });

  db.close();
});

// --- 7. AdAccount source + status updates ---------------------------------

test("client admin: super_admin can set source and status (audited)", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold");
  const client = await createClient(db, pkg.id, "Acme");
  const account = await new SqliteAdAccountRepository(db).create({
    clientId: client.id,
    name: "Acme Account",
    status: "pending",
    source: "playwright",
    metaAdAccountId: null,
  });
  const superUser = await createUser(db, "super_admin");

  const source = await runUpdateAdAccountSource(actor(superUser), account.id, "playwright", "2002", db);
  assert.equal(source.ok, true);
  if (source.ok) assert.equal(source.value.metaAdAccountId, "2002");

  const status = await runUpdateAdAccountStatus(actor(superUser), account.id, "connected", db);
  assert.equal(status.ok, true);
  if (status.ok) assert.equal(status.value.status, "connected");

  const { items } = await new SqliteAuditLogRepository(db).findByTarget(
    "ad_account",
    account.id,
    { limit: 10 }
  );
  const actions = items.map((e) => e.action).sort();
  assert.deepEqual(actions, [
    AUDIT_ACTIONS.AD_ACCOUNT_SOURCE_UPDATED,
    AUDIT_ACTIONS.AD_ACCOUNT_STATUS_UPDATED,
  ].sort());

  const sourceEntry = items.find((e) => e.action === AUDIT_ACTIONS.AD_ACCOUNT_SOURCE_UPDATED);
  assert.deepEqual(sourceEntry?.metadata, {
    clientId: client.id,
    name: "Acme Account",
    previousSource: "playwright",
    previousMetaAdAccountId: null,
  });
  const statusEntry = items.find((e) => e.action === AUDIT_ACTIONS.AD_ACCOUNT_STATUS_UPDATED);
  assert.deepEqual(statusEntry?.metadata, {
    clientId: client.id,
    name: "Acme Account",
    previousStatus: "pending",
  });

  db.close();
});

// --- 8. Tenant boundary on ad-account operations --------------------------

test("client admin: admin can manage only their assigned client's ad accounts", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold");
  const assignedClient = await createClient(db, pkg.id, "Assigned");
  const otherClient = await createClient(db, pkg.id, "Other");
  const assignedAccount = await new SqliteAdAccountRepository(db).create({
    clientId: assignedClient.id,
    name: "Assigned Account",
    status: "pending",
    source: "playwright",
    metaAdAccountId: null,
  });
  const otherAccount = await new SqliteAdAccountRepository(db).create({
    clientId: otherClient.id,
    name: "Other Account",
    status: "pending",
    source: "playwright",
    metaAdAccountId: null,
  });
  const admin = await createUser(db, "admin");
  await new SqliteAdminAssignmentRepository(db).assign(admin.id, assignedClient.id);

  // Admin may update their assigned client's account.
  const allowed = await runUpdateAdAccountStatus(actor(admin), assignedAccount.id, "connected", db);
  assert.equal(allowed.ok, true);

  // Admin is rejected on the unassigned client's account.
  const denied = await runUpdateAdAccountStatus(actor(admin), otherAccount.id, "connected", db);
  assert.equal(denied.ok, false);

  const unchanged = await new SqliteAdAccountRepository(db).findById(otherAccount.id);
  assert.equal(unchanged?.status, "pending");

  db.close();
});

// --- 9. Data loader honors tenant boundary --------------------------------

test("client admin: getAdAccountAdminData rejects unassigned client access", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold");
  const otherClient = await createClient(db, pkg.id, "Other");
  const admin = await createUser(db, "admin");

  await assert.rejects(
    () => getAdAccountAdminData(actor(admin), otherClient.id, db),
    /اجازه/,
  );

  db.close();
});

// --- 10. Client list renders ----------------------------------------------

test("client admin: the client list renders clients from the database", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db, "gold", "Gold");
  await createClient(db, pkg.id, "Client A");
  await createClient(db, pkg.id, "Client B");
  const superUser = await createUser(db, "super_admin");

  const { clients } = await getClientAdminData(actor(superUser), db);
  assert.equal(clients.length, 2);

  const html = renderToStaticMarkup(
    <ClientList
      clients={clients}
      canCreate={true}
      onCreate={() => {}}
    />
  );
  assert.ok(html.includes("Client A"));
  assert.ok(html.includes("Client B"));
  assert.ok(html.includes("مدیریت اکانت‌ها"));

  db.close();
});
