import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openPostgresDatabase, type PostgresDatabase } from "../client-pg.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * PostgreSQL migration ledger. Same conceptual model as the SQLite
 * `_migrations` table: filename-order application, applied-once
 * tracking, safe re-runs. No SQLite PRAGMAs exist here; every migration
 * runs inside a single dedicated-connection transaction so a failure
 * rolls back completely AND is never recorded as applied.
 */
export interface PostgresMigrationResult {
  applied: string[];
  skipped: string[];
}

/** Deterministic migration discovery: *.sql files, sorted by name. */
export function listPostgresMigrationFiles(
  migrationsDir: string = __dirname
): string[] {
  return readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

/**
 * Runs every PostgreSQL *.sql migration exactly once, in filename order.
 *
 * Uses ONE connection for the whole run (pool.connect()) because BEGIN/
 * COMMIT issued through separate pooled .query() calls could land on
 * different connections and silently lose atomicity.
 */
export async function runPostgresMigrations(
  db: PostgresDatabase,
  migrationsDir: string = __dirname
): Promise<PostgresMigrationResult> {
  const client = await db.pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name       TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL
      );
    `);

    const alreadyApplied = new Set(
      (
        await client.query<{ name: string }>(
          "SELECT name FROM _migrations"
        )
      ).rows.map((row) => row.name)
    );

    const result: PostgresMigrationResult = { applied: [], skipped: [] };

    for (const file of listPostgresMigrationFiles(migrationsDir)) {
      if (alreadyApplied.has(file)) {
        result.skipped.push(file);
        continue;
      }

      const sql = readFileSync(join(migrationsDir, file), "utf-8");

      try {
        await client.query("BEGIN");
        // Multi-statement execution is supported by pg when the query
        // carries no parameters — which migrations never do.
        await client.query(sql);
        await client.query(
          "INSERT INTO _migrations (name, applied_at) VALUES ($1, $2)",
          [file, new Date()]
        );
        await client.query("COMMIT");
        result.applied.push(file);
        console.log(`Applied PostgreSQL migration: ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(
          `PostgreSQL migration failed: ${file}: ${
            error instanceof Error ? error.message : String(error)
          }`,
          { cause: error }
        );
      }
    }

    return result;
  } finally {
    client.release();
  }
}

// Allows running directly with: pnpm run migrate:pg
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const db = openPostgresDatabase();
  runPostgresMigrations(db)
    .then(({ applied, skipped }) => {
      console.log(
        `PostgreSQL migrations complete. Applied: ${applied.length}. Already applied: ${skipped.length}.`
      );
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
