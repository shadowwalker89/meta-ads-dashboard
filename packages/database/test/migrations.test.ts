import { test } from "node:test";
import assert from "node:assert/strict";
import {
  copyFileSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { runMigrations } from "../src/migrations/migrate.js";

const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "migrations"
);

const ALL_FILES = [
  "001_init.sql",
  "002_add_link_clicks.sql",
  "003_add_client_id_to_users.sql",
  "004_expand_insight_metrics.sql",
  "005_pricing_rules.sql",
  "006_add_package_settings.sql",
  "007_add_package_assigned_at.sql",
  "008_add_snapshot_reporting_window.sql",
];

function createTestDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  return db;
}

test("fresh database applies every migration in order and records them", () => {
  const db = createTestDb();
  runMigrations(db);

  const applied = (
    db
      .prepare("SELECT name FROM _migrations ORDER BY name")
      .all() as { name: string }[]
  ).map((row) => row.name);
  assert.deepEqual(applied, ALL_FILES);

  const pricingTable = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'pricing_rules'"
    )
    .get();
  assert.ok(pricingTable, "pricing_rules table should exist after 005");

  const packageColumns = (
    db.prepare("PRAGMA table_info(packages)").all() as { name: string }[]
  ).map((column) => column.name);
  assert.ok(packageColumns.includes("code"), "packages.code should exist after 006");

  const clientColumns = (
    db.prepare("PRAGMA table_info(clients)").all() as { name: string }[]
  ).map((column) => column.name);
  assert.ok(
    clientColumns.includes("package_assigned_at"),
    "clients.package_assigned_at should exist after 007"
  );

  const snapshotColumns = (
    db.prepare("PRAGMA table_info(insight_snapshots)").all() as {
      name: string;
      notnull: number;
    }[]
  ).map((column) => ({ name: column.name, notnull: column.notnull }));
  const reportingFrom = snapshotColumns.find((c) => c.name === "reporting_from");
  const reportingTo = snapshotColumns.find((c) => c.name === "reporting_to");
  assert.ok(reportingFrom, "insight_snapshots.reporting_from should exist after 008");
  assert.ok(reportingTo, "insight_snapshots.reporting_to should exist after 008");
  assert.equal(reportingFrom.notnull, 0, "reporting_from must stay nullable");
  assert.equal(reportingTo.notnull, 0, "reporting_to must stay nullable");

  db.close();
});

test("005/006/007/008 re-run safely against a database that already contains their schema", () => {
  const db = createTestDb();
  runMigrations(db);

  // Seed data that must survive the re-run.
  db.prepare(
    `INSERT INTO packages (id, name, description, created_at)
     VALUES (?, ?, ?, ?)`
  ).run("pkg-1", "Gold", "Gold plan", "2026-08-01T00:00:00.000Z");
  db.prepare(
    `INSERT INTO clients (id, name, business_type, contact_email, package_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    "client-1",
    "Test Client",
    "E-commerce",
    "client@example.com",
    "pkg-1",
    "2026-08-01T00:00:00.000Z"
  );

  // Simulate "schema already present but migrations not recorded":
  // forget that 005/006/007/008 were ever applied.
  db.prepare(
    "DELETE FROM _migrations WHERE name IN ('005_pricing_rules.sql', '006_add_package_settings.sql', '007_add_package_assigned_at.sql', '008_add_snapshot_reporting_window.sql')"
  ).run();

  assert.doesNotThrow(() => runMigrations(db));

  const applied = (
    db
      .prepare("SELECT name FROM _migrations ORDER BY name")
      .all() as { name: string }[]
  ).map((row) => row.name);
  assert.deepEqual(applied, ALL_FILES, "all migrations recorded after re-run");

  // Existing data must be preserved, and the idempotent backfills
  // must still apply where NULL (code derived from name, assignment
  // time backfilled to creation time).
  const pkg = db
    .prepare("SELECT name, code FROM packages WHERE id = ?")
    .get("pkg-1") as { name: string; code: string };
  assert.equal(pkg.name, "Gold");
  assert.equal(pkg.code, "gold");

  const client = db
    .prepare("SELECT name, package_assigned_at FROM clients WHERE id = ?")
    .get("client-1") as { name: string; package_assigned_at: string };
  assert.equal(client.name, "Test Client");
  assert.equal(client.package_assigned_at, "2026-08-01T00:00:00.000Z");

  db.close();
});

test("a failing migration rolls back completely and is not recorded", () => {
  const dir = mkdtempSync(join(tmpdir(), "migrate-"));
  try {
    for (const file of readdirSync(MIGRATIONS_DIR)) {
      if (file.endsWith(".sql")) {
        copyFileSync(join(MIGRATIONS_DIR, file), join(dir, file));
      }
    }

    // Sorts last. Its first statement succeeds, its second is invalid —
    // the transaction must roll the first statement back too.
    writeFileSync(
      join(dir, "999_broken.sql"),
      "CREATE TABLE broken_probe (id TEXT PRIMARY KEY);\nTHIS IS NOT VALID SQL;\n"
    );

    const db = createTestDb();
    assert.throws(() => runMigrations(db, dir));

    const applied = (
      db.prepare("SELECT name FROM _migrations").all() as { name: string }[]
    ).map((row) => row.name);
    assert.ok(
      !applied.includes("999_broken.sql"),
      "broken migration must not be recorded"
    );
    assert.ok(
      applied.includes("001_init.sql"),
      "prior migrations must still be recorded"
    );

    const probe = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'broken_probe'"
      )
      .get();
    assert.equal(probe, undefined, "first statement of failed migration rolled back");

    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("rerunning after a recoverable failure succeeds", () => {
  const dir = mkdtempSync(join(tmpdir(), "migrate-"));
  try {
    for (const file of readdirSync(MIGRATIONS_DIR)) {
      if (file.endsWith(".sql")) {
        copyFileSync(join(MIGRATIONS_DIR, file), join(dir, file));
      }
    }
    writeFileSync(join(dir, "999_broken.sql"), "THIS IS NOT VALID SQL;\n");

    const db = createTestDb();
    assert.throws(() => runMigrations(db, dir));

    // Fix the failure (drop the broken migration), then re-run.
    rmSync(join(dir, "999_broken.sql"));
    assert.doesNotThrow(() => runMigrations(db, dir));

    const applied = (
      db
        .prepare("SELECT name FROM _migrations ORDER BY name")
        .all() as { name: string }[]
    ).map((row) => row.name);
    assert.deepEqual(applied, ALL_FILES);

    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});