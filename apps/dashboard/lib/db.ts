import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { openDatabase } from "@repo/database";

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

export function getDatabase(): ReturnType<typeof openDatabase> {
  if (!db) {
    db = openDatabase(resolveDatabasePath());
  }
  return db;
}