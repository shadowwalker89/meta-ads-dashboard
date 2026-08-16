import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { openDatabase, runMigrations } from "@repo/database";

// Server-only. Never import from middleware.ts (Edge runtime cannot
// run better-sqlite3). The default path inside @repo/database is
// relative to its own source file, which breaks once Next bundles it
// into .next — so this helper resolves the real database file path
// explicitly from the workspace root instead.
const WORKSPACE_MARKER = "pnpm-workspace.yaml";

function resolveWorkspaceRoot(): string {
  let dir = process.cwd();
  for (;;) {
    if (existsSync(join(dir, WORKSPACE_MARKER))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        "Could not locate workspace root: pnpm-workspace.yaml not found above process.cwd()"
      );
    }
    dir = parent;
  }
}

function resolveDatabasePath(): string {
  if (process.env.DATABASE_PATH) {
    return process.env.DATABASE_PATH;
  }
  return join(resolveWorkspaceRoot(), "packages", "database", "data", "app.db");
}

let db: ReturnType<typeof openDatabase> | null = null;

// Guard against a second in-process initialization racing the first.
// getDatabase() is synchronous (better-sqlite3 is synchronous), so in
// practice two calls cannot interleave; this latch makes the intent
// explicit and keeps a single migration run even if a caller ever
// triggers initialization while the first is still in flight.
let initializing = false;

export function getDatabase(): ReturnType<typeof openDatabase> {
  if (db) return db;
  if (initializing) {
    throw new Error(
      "Database initialization is already in progress; getDatabase() must not be called re-entrantly."
    );
  }

  initializing = true;
  let next: ReturnType<typeof openDatabase> | null = null;
  try {
    next = openDatabase(resolveDatabasePath());
    // Migrations must be applied before any repository reads the schema.
    // runMigrations() is transactional per file and idempotent, so this
    // is safe to run on every fresh open. If it throws, the connection
    // is closed and never cached, so a partially initialized database
    // is never returned.
    runMigrations(next);
    db = next;
    return db;
  } catch (error) {
    next?.close();
    throw error;
  } finally {
    initializing = false;
  }
}

/**
 * Test-only helper: closes and clears the cached singleton so a test can
 * exercise a fresh initialization against a different DATABASE_PATH.
 * Not used by application code.
 */
export function resetDatabaseForTests(): void {
  db?.close();
  db = null;
  initializing = false;
}