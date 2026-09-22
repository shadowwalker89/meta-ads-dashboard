import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase, runMigrations, SqliteClientRepository, SqlitePackageRepository, SqliteUserRepository } from "@repo/database";
import type { User } from "@repo/shared";
import { setApplicationUserStatus, updateApplicationUser } from "@/lib/user-lifecycle";

function db() { const value = openDatabase(":memory:"); runMigrations(value); return value; }
async function client(value: ReturnType<typeof openDatabase>) {
  const pkg = await new SqlitePackageRepository(value).create({ name: "P", description: "P", code: "p", collectionFrequency: 1, maxAdAccounts: null, maxCampaigns: null, retentionDays: null, defaultVisibleKpis: [], features: { charts: false, dataExport: false, advancedReporting: false }, pricingDefaults: {}, metricThresholds: {} });
  return new SqliteClientRepository(value).create({ name: "Client", businessType: "B", contactEmail: "client@example.com", packageId: pkg.id, isActive: true });
}
function actor(role: User["role"], id = "actor"): User { return { id, role, fullName: "Actor", email: `${id}@example.com`, clientId: null, isActive: true, createdAt: new Date() }; }
function audit() { return { recordUserUpdated: async () => {}, recordUserStatusChanged: async () => {} }; }

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
