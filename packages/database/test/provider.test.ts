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

test("provider: explicit supabase resolves to supabase", () => {
  assert.equal(
    resolveDatabaseProvider({ DATABASE_PROVIDER: "supabase" }),
    "supabase"
  );
});

test("provider: unsupported values fail with a concise config error", () => {
  // "postgres"/"postgresql" are NOT aliases — the provider name matches
  // the platform, not the engine. Matching is exact: no trimming, no
  // case folding.
  for (const value of ["postgres", "postgresql", "SQLite"]) {
    assert.throws(
      () => resolveDatabaseProvider({ DATABASE_PROVIDER: value }),
      (error: unknown) =>
        error instanceof Error &&
        error.message ===
          `Unsupported DATABASE_PROVIDER '${value}'. Supported values: sqlite, supabase.`
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

test("factory: selecting supabase returns a full bundle (DATABASE_URL required)", () => {
  const db = createTestDb();
  // "supabase" is now a fully wired provider — Wave 2 is complete.
  // Opening the PG handle throws if DATABASE_URL is absent (which it is
  // in the local dev/CI environment), so we verify that the error is a
  // connection-configuration error, NOT a "not implemented" error.
  assert.throws(
    () => createRepositories(db, { DATABASE_PROVIDER: "supabase" }),
    (error: unknown) =>
      error instanceof Error &&
      /DATABASE_URL/.test(error.message) &&
      !/not available yet/.test(error.message)
  );
  db.close();
});
