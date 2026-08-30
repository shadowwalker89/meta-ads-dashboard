import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  openPostgresDatabase,
  type PostgresDatabase,
} from "../src/client-pg.js";
import {
  listPostgresMigrationFiles,
  runPostgresMigrations,
} from "../src/migrations-pg/migrate-pg.js";

// ---------------------------------------------------------------------------
// Unit-level checks — always run, never touch a database.
// ---------------------------------------------------------------------------

const EXPECTED_TABLES = [
  "packages",
  "clients",
  "users",
  "admin_assignments",
  "ad_accounts",
  "campaigns",
  "insight_snapshots",
  "dashboard_preferences",
  "audit_logs",
  "collector_jobs",
  "pricing_rules",
];

test("pg migrations: discovery is deterministic (*.sql, filename order)", () => {
  assert.deepEqual(listPostgresMigrationFiles(), ["001_init_pg.sql"]);
});

test("pg baseline: defines every current table with approved PG types", () => {
  const sql = readFileSync(
    join(process.cwd(), "src", "migrations-pg", "001_init_pg.sql"),
    "utf-8"
  );

  for (const table of EXPECTED_TABLES) {
    assert.match(sql, new RegExp(`CREATE TABLE ${table} \\(`));
  }

  // Approved type mapping spot checks.
  assert.match(sql, /impressions\s+BIGINT NOT NULL/);
  assert.match(sql, /spend\s+DOUBLE PRECISION NOT NULL/);
  assert.match(sql, /is_active\s+BOOLEAN NOT NULL DEFAULT true/);
  assert.match(sql, /created_at\s+TIMESTAMPTZ NOT NULL/);
  assert.match(sql, /id\s+UUID PRIMARY KEY/);
  assert.match(sql, /features\s+JSONB NOT NULL DEFAULT '\{\}'/);
  // Reporting dates deliberately stay canonical YYYY-MM-DD TEXT.
  assert.match(sql, /reporting_from\s+TEXT,/);

  // Enum CHECK constraints survive verbatim.
  assert.match(sql, /role IN \('super_admin', 'admin', 'client'\)/);
  assert.match(sql, /metric IN \('spend', 'cpc', 'cpm', 'costPerResult'\)/);
});

// ---------------------------------------------------------------------------
// Integration checks — REQUIRE a disposable PostgreSQL database.
//
// Set TEST_DATABASE_URL to an EMPTY, THROWAWAY database you are willing
// to have wiped (these tests drop/recreate its public schema). For a
// local non-TLS PostgreSQL set PGSSLMODE=disable; Supabase targets work
// with the default TLS handling. Without TEST_DATABASE_URL these tests
// SKIP EXPLICITLY — they never pretend to pass.
// ---------------------------------------------------------------------------

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const pgTestOptions = TEST_DATABASE_URL
  ? { skip: false as const }
  : { skip: "TEST_DATABASE_URL not set — PostgreSQL integration skipped" };

/** Drops everything, then applies the baseline from scratch. */
async function resetAndMigrate(): Promise<PostgresDatabase> {
  const db = openPostgresDatabase({ connectionString: TEST_DATABASE_URL });
  await db.execute("DROP SCHEMA IF EXISTS public CASCADE");
  await db.execute("CREATE SCHEMA public");
  const result = await runPostgresMigrations(db);
  assert.deepEqual(result.applied, ["001_init_pg.sql"]);
  assert.deepEqual(result.skipped, []);
  return db;
}

test(
  "pg migrations: fresh database reaches the full final schema with a recorded ledger",
  pgTestOptions,
  async () => {
    const db = await resetAndMigrate();
    try {
      const ledger = await db.query<{ name: string }>(
        "SELECT name FROM _migrations ORDER BY name"
      );
      assert.deepEqual(ledger.map((r) => r.name), ["001_init_pg.sql"]);

      for (const table of [...EXPECTED_TABLES, "_migrations"]) {
        const row = await db.queryOne<{ reg: string | null }>(
          "SELECT to_regclass($1)::text AS reg",
          [`public.${table}`]
        );
        assert.equal(row?.reg, `public.${table}`, `missing table ${table}`);
      }
    } finally {
      await db.close();
    }
  }
);

test(
  "pg migrations: re-running is idempotent (skips, no duplicates)",
  pgTestOptions,
  async () => {
    const db = await resetAndMigrate();
    try {
      const before = await db.query<{ name: string }>(
        "SELECT name FROM _migrations"
      );
      const result = await runPostgresMigrations(db);
      assert.deepEqual(result.applied, []);
      assert.deepEqual(result.skipped, ["001_init_pg.sql"]);

      const after = await db.query<{ name: string }>(
        "SELECT name FROM _migrations"
      );
      assert.equal(after.length, before.length);

      const objectCount = await db.queryOne<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r','i')"
      );
      const objectCountAgain = await db.queryOne<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r','i')"
      );
      assert.equal(objectCount?.count, objectCountAgain?.count);
    } finally {
      await db.close();
    }
  }
);

test(
  "pg migrations: constraints, foreign keys and indexes match SQLite semantics",
  pgTestOptions,
  async () => {
    const db = await resetAndMigrate();
    try {
      // Foreign keys: exact per-table counts mirror the SQLite graph.
      const fkExpectations: Record<string, number> = {
        users: 1,
        clients: 1,
        admin_assignments: 2,
        ad_accounts: 1,
        campaigns: 1,
        insight_snapshots: 1,
        dashboard_preferences: 2,
        audit_logs: 1,
        collector_jobs: 1,
        pricing_rules: 1,
      };
      for (const [table, expected] of Object.entries(fkExpectations)) {
        const row = await db.queryOne<{ count: string }>(
          "SELECT COUNT(*)::text AS count FROM pg_constraint WHERE conrelid = $1::regclass AND contype = 'f'",
          [`public.${table}`]
        );
        assert.equal(
          row?.count,
          String(expected),
          `FK count mismatch on ${table}`
        );
      }

      // UNIQUE constraints (email, assignment pair) plus CHECK enums.
      const uniqueEmail = await db.queryOne<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM pg_constraint WHERE conrelid = 'public.users'::regclass AND contype = 'u'"
      );
      assert.equal(uniqueEmail?.count, "1");
      const uniqueAssignment = await db.queryOne<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM pg_constraint WHERE conrelid = 'public.admin_assignments'::regclass AND contype = 'u'"
      );
      assert.equal(uniqueAssignment?.count, "1");

      const checkExpectations: Record<string, number> = {
        users: 1,
        ad_accounts: 2,
        collector_jobs: 2,
        pricing_rules: 2,
      };
      for (const [table, expected] of Object.entries(checkExpectations)) {
        const row = await db.queryOne<{ count: string }>(
          "SELECT COUNT(*)::text AS count FROM pg_constraint WHERE conrelid = $1::regclass AND contype = 'c'",
          [`public.${table}`]
        );
        assert.equal(
          row?.count,
          String(expected),
          `CHECK count mismatch on ${table}`
        );
      }

      // Indexes recreated from SQLite, including the unique package code.
      const indexNames = [
        "idx_packages_code",
        "idx_clients_package_id",
        "idx_admin_assignments_admin",
        "idx_admin_assignments_client",
        "idx_ad_accounts_client_id",
        "idx_campaigns_ad_account_id",
        "idx_insight_snapshots_campaign_id",
        "idx_insight_snapshots_captured_at",
        "idx_audit_logs_actor",
        "idx_audit_logs_target",
        "idx_collector_jobs_ad_account_id",
        "idx_pricing_rules_client",
      ];
      for (const indexName of indexNames) {
        const row = await db.queryOne<{ reg: string | null }>(
          "SELECT to_regclass($1)::text AS reg",
          [`public.${indexName}`]
        );
        assert.ok(row?.reg, `missing index ${indexName}`);
      }
      const codeIndexIsUnique = await db.queryOne<{ indisunique: boolean }>(
        "SELECT i.indisunique FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE c.relname = 'idx_packages_code'"
      );
      assert.equal(codeIndexIsUnique?.indisunique, true);
    } finally {
      await db.close();
    }
  }
);

test(
  "pg migrations: representative columns use the approved types",
  pgTestOptions,
  async () => {
    const db = await resetAndMigrate();
    try {
      const typeExpectations: Array<[string, string, string]> = [
        ["insight_snapshots", "impressions", "bigint"],
        ["insight_snapshots", "spend", "double precision"],
        ["clients", "is_active", "boolean"],
        ["users", "created_at", "timestamp with time zone"],
        ["users", "id", "uuid"],
        ["packages", "features", "jsonb"],
        ["insight_snapshots", "reporting_from", "text"],
      ];
      for (const [table, column, expected] of typeExpectations) {
        const row = await db.queryOne<{ data_type: string }>(
          "SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2",
          [table, column]
        );
        assert.equal(
          row?.data_type,
          expected,
          `${table}.${column} should be ${expected}`
        );
      }
    } finally {
      await db.close();
    }
  }
);

test(
  "pg migrations: a failing migration rolls back and is NOT recorded",
  pgTestOptions,
  async () => {
    const db = await resetAndMigrate();
    try {
      const badDir = mkdtempSync(join(tmpdir(), "pg-migration-bad-"));
      try {
        writeFileSync(
          join(badDir, "001_init_pg.sql"),
          readFileSync(join(process.cwd(), "src", "migrations-pg", "001_init_pg.sql"))
        );
        writeFileSync(
          join(badDir, "002_broken.sql"),
          "THIS IS NOT VALID SQL;"
        );

        await assert.rejects(
          () => runPostgresMigrations(db, badDir),
          /002_broken\.sql/
        );

        // The failed migration must not appear in the ledger...
        const ledger = await db.query<{ name: string }>(
          "SELECT name FROM _migrations"
        );
        assert.deepEqual(ledger.map((r) => r.name), ["001_init_pg.sql"]);
        // ...and its partial work must be rolled back (no junk table).
        const junk = await db.queryOne<{ reg: string | null }>(
          "SELECT to_regclass($1)::text AS reg",
          ["public.broken_table"]
        );
        assert.equal(junk?.reg, null);
      } finally {
        rmSync(badDir, { recursive: true, force: true });
      }
    } finally {
      await db.close();
    }
  }
);
