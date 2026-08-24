import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { runMigrations } from "../src/migrations/migrate.js";
import {
  SqliteClientRepository,
  SqliteUserRepository,
} from "../src/repositories/index.js";
import {
  createRepositories,
  resolveDatabaseProvider,
} from "../src/provider.js";

// A fresh in-memory database per test — never touches the real
// data/app.db file, so this is safe to run at any time.
function createTestDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

test("provider: absent DATABASE_PROVIDER defaults to sqlite", () => {
  assert.equal(resolveDatabaseProvider({}), "sqlite");
});

test("provider: empty DATABASE_PROVIDER defaults to sqlite", () => {
  assert.equal(resolveDatabaseProvider({ DATABASE_PROVIDER: "" }), "sqlite");
});

test("provider: explicit sqlite resolves to sqlite", () => {
  assert.equal(
    resolveDatabaseProvider({ DATABASE_PROVIDER: "sqlite" }),
    "sqlite"
  );
});

test("provider: unsupported values fail with a concise config error", () => {
  // supabase is deliberately NOT a supported value yet: there is no
  // implementation, so selecting it must fail loudly instead of
  // silently falling back to sqlite. Matching is exact — no aliases.
  for (const value of ["supabase", "postgres", "postgresql", "SQLite"]) {
    assert.throws(
      () => resolveDatabaseProvider({ DATABASE_PROVIDER: value }),
      (error: unknown) =>
        error instanceof Error &&
        error.message ===
          `Unsupported DATABASE_PROVIDER '${value}'. Supported values: sqlite.`
    );
  }
});

test("factory: returns the full SQLite bundle over the given handle", () => {
  const db = createTestDb();
  const repos = createRepositories(db);

  assert.deepEqual(Object.keys(repos).sort(), [
    "adAccountRepository",
    "adminAssignmentRepository",
    "auditLogRepository",
    "campaignRepository",
    "clientRepository",
    "collectorJobRepository",
    "dashboardPreferenceRepository",
    "insightSnapshotRepository",
    "packageRepository",
    "pricingRuleRepository",
    "userRepository",
  ]);

  // The same existing Sqlite implementations, on the SAME handle —
  // not wrappers and not a different connection.
  assert.ok(repos.clientRepository instanceof SqliteClientRepository);
  assert.ok(repos.userRepository instanceof SqliteUserRepository);

  db.close();
});

test("factory: an explicitly unsupported provider fails instead of falling back", () => {
  const db = createTestDb();
  assert.throws(
    () => createRepositories(db, { DATABASE_PROVIDER: "supabase" }),
    /Supported values: sqlite\./
  );
  db.close();
});
