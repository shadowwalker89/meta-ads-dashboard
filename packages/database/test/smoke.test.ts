import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { runMigrations } from "../src/migrations/migrate.js";
import {
  SqliteUserRepository,
  SqliteClientRepository,
  SqlitePackageRepository,
} from "../src/repositories/index.js";

// A fresh in-memory database per test — never touches the real
// data/app.db file, so this is safe to run at any time.
function createTestDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

test("database opens and migrations create all expected tables", () => {
  const db = createTestDb();

  const tables = (
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
      name: string;
    }[]
  ).map((row) => row.name);

  for (const expected of [
    "users",
    "packages",
    "clients",
    "admin_assignments",
    "ad_accounts",
    "campaigns",
    "insight_snapshots",
    "dashboard_preferences",
    "audit_logs",
    "collector_jobs",
  ]) {
    assert.ok(tables.includes(expected), `missing table: ${expected}`);
  }

  db.close();
});

test("repositories can write and read back seeded-style data", async () => {
  const db = createTestDb();

  const packages = new SqlitePackageRepository(db);
  const users = new SqliteUserRepository(db);
  const clients = new SqliteClientRepository(db);

  const pkg = await packages.create({
    name: "Gold",
    description: "Gold plan",
    metricThresholds: { minViews: 1000 },
  });

  const admin = await users.create({
    role: "admin",
    fullName: "Test Admin",
    email: "test-admin@example.com",
    clientId: null,
  });

  const client = await clients.create({
    name: "Test Client",
    businessType: "E-commerce",
    contactEmail: "test-client@example.com",
    packageId: pkg.id,
    isActive: true,
  });

  const clientUser = await users.create({
    role: "client",
    fullName: "Test Client User",
    email: "test-client-user@example.com",
    clientId: client.id,
  });

  const foundPackage = await packages.findById(pkg.id);
  const foundAdmin = await users.findById(admin.id);
  const foundClient = await clients.findById(client.id);
  const foundClientUser = await users.findById(clientUser.id);
  const allPackages = await packages.listAll();

  assert.equal(foundPackage?.name, "Gold");
  assert.deepEqual(foundPackage?.metricThresholds, { minViews: 1000 });
  assert.equal(foundAdmin?.role, "admin");
  assert.equal(foundAdmin?.clientId, null);
  assert.equal(foundClient?.packageId, pkg.id);
  assert.equal(foundClientUser?.clientId, client.id);
  assert.equal(allPackages.length, 1);

  db.close();
});
