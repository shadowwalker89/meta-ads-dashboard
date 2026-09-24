import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase, runMigrations, SqliteClientRepository, SqlitePackageRepository, SqliteUserRepository } from "@repo/database";
import type { User } from "@repo/shared";
import type { SupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { setApplicationUserPassword, setApplicationUserStatus, updateApplicationUser, UserLifecycleError } from "@/lib/user-lifecycle";

function db() { const value = openDatabase(":memory:"); runMigrations(value); return value; }
async function client(value: ReturnType<typeof openDatabase>) {
  const pkg = await new SqlitePackageRepository(value).create({ name: "P", description: "P", code: "p", collectionFrequency: 1, maxAdAccounts: null, maxCampaigns: null, retentionDays: null, defaultVisibleKpis: [], features: { charts: false, dataExport: false, advancedReporting: false }, pricingDefaults: {}, metricThresholds: {} });
  return new SqliteClientRepository(value).create({ name: "Client", businessType: "B", contactEmail: "client@example.com", packageId: pkg.id, isActive: true });
}
function actor(role: User["role"], id = "actor"): User { return { id, role, fullName: "Actor", email: `${id}@example.com`, clientId: null, isActive: true, createdAt: new Date() }; }
function audit() { return { recordUserUpdated: async () => {}, recordUserStatusChanged: async () => {} }; }

function passwordAuthRecorder() {
  const calls: Array<{ id: string; input: { password?: string; email_confirm?: boolean } }> = [];
  const auth: SupabaseAdminClient = {
    auth: {
      admin: {
        async createUser() { return { data: { user: null }, error: { message: "not used" } }; },
        async deleteUser() { return { error: null }; },
        async getUserById(id: string) { return { data: { user: { id, email: null } }, error: null }; },
        async updateUserById(id, input) { calls.push({ id, input }); return { data: { user: { id, email: null } }, error: null }; },
      },
    },
  };
  return { auth, calls };
}

test("lifecycle: admin edits authorized client user and preserves id", async () => {
  const value = db(); const c = await client(value); const users = new SqliteUserRepository(value); const target = await users.create({ role: "client", fullName: "Old", email: "old@example.com", clientId: c.id, authId: null, isActive: true });
  const result = await updateApplicationUser(actor("admin"), { userId: target.id, fullName: "New", role: "client", clientId: c.id }, { db: value, deps: { users, audit: audit(), accessibleClientIds: async () => [c.id] } });
  assert.equal(result.user.id, target.id); assert.equal(result.user.fullName, "New"); value.close();
});

test("lifecycle: admin cannot edit admin and cannot cross client scope", async () => {
  const value = db(); const c = await client(value); const users = new SqliteUserRepository(value); const admin = await users.create({ role: "admin", fullName: "Admin", email: "admin@example.com", clientId: null, authId: null, isActive: true });
  await assert.rejects(() => updateApplicationUser(actor("admin"), { userId: admin.id, fullName: "No", role: "client", clientId: c.id }, { db: value, deps: { users, audit: audit(), accessibleClientIds: async () => [c.id] } }), /Admins can only edit client users/);
  value.close();
});

test("lifecycle: deactivation preserves user and audits status", async () => {
  const value = db(); const c = await client(value); const users = new SqliteUserRepository(value); const target = await users.create({ role: "client", fullName: "Client", email: "client2@example.com", clientId: c.id, authId: "auth-id", isActive: true }); let audited = false;
  const result = await setApplicationUserStatus(actor("admin"), { userId: target.id, isActive: false }, { db: value, deps: { users, audit: { recordUserUpdated: async () => {}, recordUserStatusChanged: async () => { audited = true; } }, accessibleClientIds: async () => [c.id] } });
  assert.equal(result.user.id, target.id); assert.equal(result.user.isActive, false); assert.equal(audited, true); assert.equal((await users.findById(target.id))?.authId, "auth-id"); value.close();
});

test("lifecycle: self-deactivation is rejected and super_admin is protected", async () => {
  const value = db(); const users = new SqliteUserRepository(value); const admin = await users.create({ role: "admin", fullName: "Admin", email: "admin2@example.com", clientId: null, authId: null, isActive: true });
  await assert.rejects(() => setApplicationUserStatus({ ...actor("admin", admin.id), email: admin.email }, { userId: admin.id, isActive: false }, { db: value, deps: { users, audit: audit(), accessibleClientIds: async () => [] } }), /cannot deactivate your own account/i);
  const superUser = await users.create({ role: "super_admin", fullName: "Super", email: "super2@example.com", clientId: null, authId: null, isActive: true });
  await assert.rejects(() => updateApplicationUser(actor("super_admin"), { userId: superUser.id, fullName: "No", role: "admin", clientId: null }, { db: value, deps: { users, audit: audit(), accessibleClientIds: async () => [] } }), /protected super_admin/i);
  value.close();
});

test("password: super_admin can set a password for a client user with email_confirm true", async () => {
  const value = db(); const c = await client(value); const users = new SqliteUserRepository(value);
  const target = await users.create({ role: "client", fullName: "Client", email: "pw-client@example.com", clientId: c.id, authId: "auth-target", isActive: true });
  const recorder = passwordAuthRecorder();
  const result = await setApplicationUserPassword(actor("super_admin"), { userId: target.id, password: "new-strong-pw" }, { db: value, deps: { users, auth: recorder.auth, audit: audit(), accessibleClientIds: async () => [c.id] } });
  assert.equal(result.auditRecorded, true);
  assert.equal(result.user.id, target.id);
  assert.equal(recorder.calls.length, 1);
  assert.equal(recorder.calls[0].id, "auth-target");
  assert.equal(recorder.calls[0].input.password, "new-strong-pw");
  assert.equal(recorder.calls[0].input.email_confirm, true, "email confirmation must be preserved when admin sets password");
  value.close();
});

test("password: admin can set a password only for client users in their scope", async () => {
  const value = db(); const c = await client(value); const users = new SqliteUserRepository(value);
  const target = await users.create({ role: "client", fullName: "InScope", email: "inscope@example.com", clientId: c.id, authId: "auth-inscope", isActive: true });
  const recorder = passwordAuthRecorder();
  const result = await setApplicationUserPassword(actor("admin"), { userId: target.id, password: "good-pw-123" }, { db: value, deps: { users, auth: recorder.auth, audit: audit(), accessibleClientIds: async () => [c.id] } });
  assert.equal(result.auditRecorded, true);
  assert.equal(recorder.calls.length, 1);
  assert.equal(recorder.calls[0].input.password, "good-pw-123");
  assert.equal(recorder.calls[0].input.email_confirm, true);
  value.close();
});

test("password: admin cannot set password for an admin or super_admin target", async () => {
  const value = db(); const users = new SqliteUserRepository(value);
  const adminTarget = await users.create({ role: "admin", fullName: "Admin", email: "target-admin@example.com", clientId: null, authId: "auth-admin", isActive: true });
  const superTarget = await users.create({ role: "super_admin", fullName: "Super", email: "target-super@example.com", clientId: null, authId: "auth-super", isActive: true });
  const recorder = passwordAuthRecorder();
  await assert.rejects(
    () => setApplicationUserPassword(actor("admin"), { userId: adminTarget.id, password: "good-pw-123" }, { db: value, deps: { users, auth: recorder.auth, accessibleClientIds: async () => [] } }),
    (error: unknown) => error instanceof UserLifecycleError && error.code === "forbidden"
  );
  await assert.rejects(
    () => setApplicationUserPassword(actor("admin"), { userId: superTarget.id, password: "good-pw-123" }, { db: value, deps: { users, auth: recorder.auth, accessibleClientIds: async () => [] } }),
    (error: unknown) => error instanceof UserLifecycleError && error.code === "protected_super_admin"
  );
  assert.equal(recorder.calls.length, 0, "no Supabase Auth call must be made for unauthorized password sets");
  value.close();
});

test("password: client user cannot set another user's password", async () => {
  const value = db(); const c = await client(value); const users = new SqliteUserRepository(value);
  const target = await users.create({ role: "client", fullName: "Other", email: "other@example.com", clientId: c.id, authId: "auth-other", isActive: true });
  const recorder = passwordAuthRecorder();
  await assert.rejects(
    () => setApplicationUserPassword(actor("client"), { userId: target.id, password: "good-pw-123" }, { db: value, deps: { users, auth: recorder.auth, accessibleClientIds: async () => [c.id] } }),
    (error: unknown) => error instanceof UserLifecycleError && error.code === "forbidden"
  );
  assert.equal(recorder.calls.length, 0, "unauthorized user must not reach Supabase Auth");
  value.close();
});

test("password: super_admin cannot set password for another super_admin (protected)", async () => {
  const value = db(); const users = new SqliteUserRepository(value);
  const superTarget = await users.create({ role: "super_admin", fullName: "Super", email: "super3@example.com", clientId: null, authId: "auth-super-3", isActive: true });
  const recorder = passwordAuthRecorder();
  await assert.rejects(
    () => setApplicationUserPassword(actor("super_admin"), { userId: superTarget.id, password: "good-pw-123" }, { db: value, deps: { users, auth: recorder.auth, accessibleClientIds: async () => [] } }),
    (error: unknown) => error instanceof UserLifecycleError && error.code === "protected_super_admin"
  );
  assert.equal(recorder.calls.length, 0);
  value.close();
});

test("password: rejects empty input and missing auth identity", async () => {
  const value = db(); const c = await client(value); const users = new SqliteUserRepository(value);
  const target = await users.create({ role: "client", fullName: "NoAuth", email: "noauth@example.com", clientId: c.id, authId: null, isActive: true });
  const recorder = passwordAuthRecorder();
  await assert.rejects(
    () => setApplicationUserPassword(actor("super_admin"), { userId: target.id, password: "" }, { db: value, deps: { users, auth: recorder.auth, accessibleClientIds: async () => [c.id] } }),
    (error: unknown) => error instanceof UserLifecycleError && error.code === "invalid_input"
  );
  await assert.rejects(
    () => setApplicationUserPassword(actor("super_admin"), { userId: target.id, password: "good-pw-123" }, { db: value, deps: { users, auth: recorder.auth, accessibleClientIds: async () => [c.id] } }),
    (error: unknown) => error instanceof UserLifecycleError && error.code === "no_auth_identity"
  );
  assert.equal(recorder.calls.length, 0);
  value.close();
});

test("password: admin cannot set password for a client outside their scope", async () => {
  const value = db(); const c = await client(value); const users = new SqliteUserRepository(value);
  const target = await users.create({ role: "client", fullName: "OutOfScope", email: "outofscope@example.com", clientId: c.id, authId: "auth-out", isActive: true });
  const recorder = passwordAuthRecorder();
  await assert.rejects(
    () => setApplicationUserPassword(actor("admin"), { userId: target.id, password: "good-pw-123" }, { db: value, deps: { users, auth: recorder.auth, accessibleClientIds: async () => ["other-client"] } }),
    (error: unknown) => error instanceof UserLifecycleError && error.code === "client_scope"
  );
  assert.equal(recorder.calls.length, 0);
  value.close();
});

test("password: Supabase Auth error is reported with auth_error code", async () => {
  const value = db(); const c = await client(value); const users = new SqliteUserRepository(value);
  const target = await users.create({ role: "client", fullName: "Bad", email: "bad@example.com", clientId: c.id, authId: "auth-bad", isActive: true });
  const failingAuth: SupabaseAdminClient = {
    auth: {
      admin: {
        async createUser() { return { data: { user: null }, error: null }; },
        async deleteUser() { return { error: null }; },
        async getUserById() { return { data: { user: null }, error: null }; },
        async updateUserById() { return { data: { user: null }, error: { message: "auth backend down" } }; },
      },
    },
  };
  await assert.rejects(
    () => setApplicationUserPassword(actor("super_admin"), { userId: target.id, password: "good-pw-123" }, { db: value, deps: { users, auth: failingAuth, accessibleClientIds: async () => [c.id] } }),
    (error: unknown) => error instanceof UserLifecycleError && error.code === "auth_error"
  );
  value.close();
});
