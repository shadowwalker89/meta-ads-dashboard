import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase, runMigrations, SqliteClientRepository, SqlitePackageRepository, SqliteUserRepository } from "@repo/database";
import type { User } from "@repo/shared";
import type { SupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { ProvisioningError, provisionApplicationUser } from "@/lib/user-provisioning";

function createDb() {
  const db = openDatabase(":memory:");
  runMigrations(db);
  return db;
}

async function createClient(db: ReturnType<typeof openDatabase>) {
  const pkg = await new SqlitePackageRepository(db).create({
    name: "Test", description: "Test", code: "test", collectionFrequency: 1,
    maxAdAccounts: null, maxCampaigns: null, retentionDays: null,
    defaultVisibleKpis: [], features: { charts: false, dataExport: false, advancedReporting: false },
    pricingDefaults: {}, metricThresholds: {},
  });
  return new SqliteClientRepository(db).create({
    name: "Client", businessType: "Test", contactEmail: "client@example.com",
    packageId: pkg.id, isActive: true,
  });
}

let authSequence = 0;

function authFake(options: { createError?: { message: string; code?: string }; failDelete?: boolean } = {}) {
  authSequence += 1;
  const created = { id: `auth-created-${authSequence}`, email: "new@example.com" };
  let createCalls = 0;
  let deleteCalls = 0;
  const auth: SupabaseAdminClient = {
    auth: {
      admin: {
        async createUser() {
          createCalls += 1;
          return { data: { user: options.createError ? null : created }, error: options.createError ?? null };
        },
        async deleteUser() {
          deleteCalls += 1;
          return { error: options.failDelete ? { message: "cleanup failed" } : null };
        },
      },
    },
  };
  return { auth, createdId: created.id, counts: () => ({ createCalls, deleteCalls }) };
}

function auditFake(fail = false) {
  const events: User[] = [];
  return {
    audit: { recordUserCreated: async (_actor: Pick<User, "id" | "role">, user: User) => {
      if (fail) throw new Error("audit failure");
      events.push(user);
    } },
    events,
  };
}

function actor(role: User["role"]): Pick<User, "id" | "role" | "clientId"> {
  return { id: `actor-${role}`, role, clientId: null };
}

const allowedClient = async () => ["client-allowed"];

test("provisioning: role policy matrix", async () => {
  const db = createDb();
  const client = await createClient(db);
  const roles: Array<[User["role"], "admin" | "client", boolean]> = [
    ["super_admin", "admin", true], ["super_admin", "client", true],
    ["admin", "client", true], ["admin", "admin", false],
    ["client", "client", false], ["client", "admin", false],
  ];
  for (const [actorRole, targetRole, allowed] of roles) {
    const fake = authFake();
    const audit = auditFake();
    const operation = provisionApplicationUser(actor(actorRole), {
      email: `${actorRole}-${targetRole}@example.com`, fullName: "Test User",
      role: targetRole, clientId: targetRole === "client" ? client.id : null, password: "not-used",
    }, { db, deps: { auth: fake.auth, audit: audit.audit, accessibleClientIds: async () => [client.id] } });
    if (allowed) {
      const result = await operation;
      assert.equal(result.role, targetRole);
    } else {
      await assert.rejects(operation, (error: unknown) => error instanceof ProvisioningError && error.code === "forbidden");
    }
  }
  await assert.rejects(
    () => provisionApplicationUser(actor("super_admin"), {
      email: "super@example.com", fullName: "Super", role: "super_admin", password: "not-used",
    }, { db, deps: { auth: authFake().auth, audit: auditFake().audit, accessibleClientIds: allowedClient } }),
    (error: unknown) => error instanceof ProvisioningError && error.code === "forbidden"
  );
  db.close();
});

test("provisioning: creates Auth identity, application user, auth_id, and audit event", async () => {
  const db = createDb();
  const client = await createClient(db);
  const fake = authFake();
  const audit = auditFake();
  const result = await provisionApplicationUser(actor("admin"), {
    email: " New@Example.com ", fullName: "New User", role: "client", clientId: client.id, password: "not-used",
  }, { db, deps: { auth: fake.auth, audit: audit.audit, accessibleClientIds: async () => [client.id] } });
  assert.deepEqual(result, { id: result.id, email: "new@example.com", fullName: "New User", role: "client", clientId: client.id, auditRecorded: true });
  const row = await new SqliteUserRepository(db).findByAuthId(fake.createdId);
  assert.equal(row?.role, "client");
  assert.equal(row?.clientId, client.id);
  assert.equal(row?.email, "new@example.com");
  assert.equal(audit.events.length, 1);
  db.close();
});

test("provisioning: validates client scope and duplicates before Auth creation", async () => {
  const db = createDb();
  const fake = authFake();
  const audit = auditFake();
  await assert.rejects(() => provisionApplicationUser(actor("admin"), {
    email: "bad@example.com", fullName: "Bad", role: "client", password: "not-used",
  }, { db, deps: { auth: fake.auth, audit: audit.audit, accessibleClientIds: allowedClient } }), /client is required/i);
  await new SqliteUserRepository(db).create({ role: "admin", fullName: "Existing", email: "existing@example.com", clientId: null });
  await assert.rejects(() => provisionApplicationUser(actor("super_admin"), {
    email: "existing@example.com", fullName: "Other", role: "admin", password: "not-used",
  }, { db, deps: { auth: fake.auth, audit: audit.audit, accessibleClientIds: allowedClient } }), (error: unknown) => error instanceof ProvisioningError && error.code === "duplicate_application_user");
  assert.deepEqual(fake.counts(), { createCalls: 0, deleteCalls: 0 });
  db.close();
});

test("provisioning: duplicate Auth user is controlled and no application row is created", async () => {
  const db = createDb();
  const fake = authFake({ createError: { message: "User already exists", code: "user_already_exists" } });
  const audit = auditFake();
  await assert.rejects(() => provisionApplicationUser(actor("super_admin"), {
    email: "auth-existing@example.com", fullName: "Existing", role: "admin", password: "not-used",
  }, { db, deps: { auth: fake.auth, audit: audit.audit, accessibleClientIds: allowedClient } }), (error: unknown) => error instanceof ProvisioningError && error.code === "duplicate_auth_user");
  assert.equal(await new SqliteUserRepository(db).findByNormalizedEmail("auth-existing@example.com"), null);
  db.close();
});

test("provisioning: rejected requests do not resolve the Admin client", async () => {
  const db = createDb();
  const client = await createClient(db);
  const deps = {
    audit: auditFake().audit,
    accessibleClientIds: async () => [client.id],
  };
  await assert.rejects(() => provisionApplicationUser(actor("client"), {
    email: "denied@example.com", fullName: "Denied", role: "client", clientId: client.id, password: "not-used",
  }, { db, deps }), (error: unknown) => error instanceof ProvisioningError && error.code === "forbidden");

  await assert.rejects(() => provisionApplicationUser(actor("admin"), {
    email: "bad-role@example.com", fullName: "Bad Role", role: "super_admin", password: "not-used",
  }, { db, deps }), (error: unknown) => error instanceof ProvisioningError && error.code === "forbidden");
  db.close();
});

test("provisioning: audit failure preserves completed provisioning with a warning result", async () => {
  const db = createDb();
  const client = await createClient(db);
  const fake = authFake();
  const result = await provisionApplicationUser(actor("admin"), {
    email: "audit-failure@example.com", fullName: "Audit Failure", role: "client", clientId: client.id, password: "not-used",
  }, { db, deps: { auth: fake.auth, audit: auditFake(true).audit, accessibleClientIds: async () => [client.id] } });
  assert.equal(result.auditRecorded, false);
  assert.equal(fake.counts().deleteCalls, 0);
  assert.equal((await new SqliteUserRepository(db).findByNormalizedEmail("audit-failure@example.com"))?.role, "client");
  db.close();
});

test("provisioning: application persistence failure compensates only the created Auth identity", async () => {
  const db = createDb();
  const fake = authFake();
  const audit = auditFake();
  const baseUsers = new SqliteUserRepository(db);
  const failingUsers = {
    findById: baseUsers.findById.bind(baseUsers),
    findByEmail: baseUsers.findByEmail.bind(baseUsers),
    findByNormalizedEmail: baseUsers.findByNormalizedEmail.bind(baseUsers),
    findByAuthId: baseUsers.findByAuthId.bind(baseUsers),
    setAuthId: baseUsers.setAuthId.bind(baseUsers),
    update: baseUsers.update.bind(baseUsers),
    async create(): Promise<never> { throw new Error("database failure"); },
  };
  await assert.rejects(() => provisionApplicationUser(actor("super_admin"), {
    email: "failed@example.com", fullName: "Failed", role: "admin", password: "not-used",
  }, { db, deps: { users: failingUsers, auth: fake.auth, audit: audit.audit, accessibleClientIds: allowedClient } }), /cleaned up/i);
  assert.deepEqual(fake.counts(), { createCalls: 1, deleteCalls: 1 });
  db.close();
});
