import "./setup";
import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, runMigrations } from "@repo/database";
import { getDatabase, resetDatabaseForTests } from "@/lib/db";

type Db = ReturnType<typeof openDatabase>;

const EXPECTED_MIGRATIONS = [
  "001_init.sql",
  "002_add_link_clicks.sql",
  "003_add_client_id_to_users.sql",
  "004_expand_insight_metrics.sql",
  "005_pricing_rules.sql",
  "006_add_package_settings.sql",
  "007_add_package_assigned_at.sql",
  "008_add_snapshot_reporting_window.sql",
  "009_add_campaign_assignments.sql",
];

const ORIGINAL_DATABASE_PATH = process.env.DATABASE_PATH;

// Each test uses its own temp DB file and resets the module-level
// singleton so scenarios are fully independent.
const tempDirs: string[] = [];

beforeEach(() => {
  resetDatabaseForTests();
  if (ORIGINAL_DATABASE_PATH === undefined) {
    delete process.env.DATABASE_PATH;
  } else {
    process.env.DATABASE_PATH = ORIGINAL_DATABASE_PATH;
  }
});

after(async () => {
  resetDatabaseForTests();
  for (const dir of tempDirs) {
    await removeDirWithRetry(dir);
  }
});

// Windows can keep a SQLite file handle locked for a moment after
// close(); retry a few times before giving up.
async function removeDirWithRetry(dir: string): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      rmSync(dir, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
}

function tempDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "dash-db-"));
  tempDirs.push(dir);
  return join(dir, "app.db");
}

function setDatabasePath(path: string): void {
  process.env.DATABASE_PATH = path;
}

function appliedMigrations(db: Db): string[] {
  return (
    db
      .prepare("SELECT name FROM _migrations ORDER BY name")
      .all() as { name: string }[]
  ).map((row) => row.name);
}

test("fresh dashboard database initializes successfully and has all migrations applied", () => {
  const path = tempDbPath();
  try {
    setDatabasePath(path);
    const db = getDatabase();
    assert.ok(db, "getDatabase() must return a database");
    assert.deepEqual(appliedMigrations(db), EXPECTED_MIGRATIONS);

    // A late migration's column must actually be present.
    const clientColumns = (
      db.prepare("PRAGMA table_info(clients)").all() as { name: string }[]
    ).map((column) => column.name);
    assert.ok(
      clientColumns.includes("package_assigned_at"),
      "clients.package_assigned_at should exist after 007"
    );

    const snapshotColumns = (
      db.prepare("PRAGMA table_info(insight_snapshots)").all() as { name: string }[]
    ).map((column) => column.name);
    assert.ok(
      snapshotColumns.includes("reporting_from") && snapshotColumns.includes("reporting_to"),
      "insight_snapshots reporting window columns should exist after 008"
    );
  } finally {
    resetDatabaseForTests();
  }
});

test("repeated getDatabase() does not re-run migrations unnecessarily", () => {
  const path = tempDbPath();
  try {
    setDatabasePath(path);
    const first = getDatabase();
    const firstAppliedAt = (
      first
        .prepare("SELECT applied_at FROM _migrations WHERE name = ?")
        .get("001_init.sql") as { applied_at: string }
    ).applied_at;

    const second = getDatabase();
    assert.equal(second, first, "must return the cached singleton instance");

    const secondAppliedAt = (
      first
        .prepare("SELECT applied_at FROM _migrations WHERE name = ?")
        .get("001_init.sql") as { applied_at: string }
    ).applied_at;
    assert.equal(
      secondAppliedAt,
      firstAppliedAt,
      "migrations must not be re-applied on a cached instance"
    );
  } finally {
    resetDatabaseForTests();
  }
});

test("existing database remains unchanged", () => {
  const path = tempDbPath();
  try {
    // Pre-create a fully migrated database with a marker row.
    const pre = openDatabase(path);
    runMigrations(pre);
    pre
      .prepare(
        `INSERT INTO packages (id, name, description, code, collection_frequency, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        "pkg-existing",
        "Existing",
        "Existing plan",
        "existing",
        1,
        "2026-08-01T00:00:00.000Z"
      );
    pre.close();

    setDatabasePath(path);
    const db = getDatabase();
    assert.deepEqual(appliedMigrations(db), EXPECTED_MIGRATIONS);

    const row = db
      .prepare("SELECT name FROM packages WHERE id = ?")
      .get("pkg-existing") as { name: string };
    assert.equal(row.name, "Existing", "existing data must survive bootstrap");
  } finally {
    resetDatabaseForTests();
  }
});

test("migration failure prevents successful database initialization", () => {
  const path = tempDbPath();
  try {
    // A valid SQLite file whose schema makes migration 006 fail: it
    // references packages.name for the backfill, so a packages table
    // without that column forces a genuine migration error. This also
    // proves getDatabase() fails fast and never returns the partially
    // migrated database (006 and everything after it are rolled back).
    const pre = openDatabase(path);
    pre.exec("CREATE TABLE packages (id TEXT PRIMARY KEY);");
    pre.close();

    setDatabasePath(path);
    assert.throws(() => getDatabase(), /no such column/i);

    // The partially initialized connection must not be cached: a second
    // attempt fails again rather than returning a broken database.
    assert.throws(() => getDatabase());
  } finally {
    resetDatabaseForTests();
  }
});

test("existing dashboard behavior remains unchanged (repositories read migrated schema)", () => {
  const path = tempDbPath();
  try {
    setDatabasePath(path);
    const db = getDatabase();

    // Write and read back a package exactly as repositories do elsewhere.
    db.prepare(
      `INSERT INTO packages (id, name, description, code, collection_frequency, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      "pkg-behavior",
      "Behavior",
      "Behavior plan",
      "behavior",
      1,
      "2026-08-01T00:00:00.000Z"
    );
    const row = db
      .prepare("SELECT name FROM packages WHERE id = ?")
      .get("pkg-behavior") as { name: string };
    assert.equal(row.name, "Behavior");
  } finally {
    resetDatabaseForTests();
  }
});