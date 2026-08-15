import Database from "better-sqlite3";
import { mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_DB_PATH = join(__dirname, "..", "data", "app.db");

const NATIVE_BINDING = join(
  __dirname,
  "..",
  "node_modules",
  "better-sqlite3",
  "build",
  "Release",
  "better_sqlite3.node"
);

/**
 * Opens (and creates, if needed) the SQLite database file.
 * Pass ":memory:" for an in-memory database (used by tests).
 */
export function openDatabase(path: string = DEFAULT_DB_PATH): Database.Database {
  if (path !== ":memory:") {
    const dir = dirname(path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(path, { nativeBinding: NATIVE_BINDING });
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}
