import type Database from "better-sqlite3";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "../client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Runs every *.sql file in this folder, in filename order, exactly once.
 * Applied migrations are tracked in the _migrations table, so running
 * this multiple times is safe (already-applied files are skipped).
 */
export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name       TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const files = readdirSync(__dirname)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const alreadyApplied = new Set(
    (db.prepare("SELECT name FROM _migrations").all() as { name: string }[]).map(
      (row) => row.name
    )
  );

  for (const file of files) {
    if (alreadyApplied.has(file)) continue;

    const sql = readFileSync(join(__dirname, file), "utf-8");
    db.exec(sql);
    db.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)").run(
      file,
      new Date().toISOString()
    );
    console.log(`Applied migration: ${file}`);
  }
}

// Allows running directly with: pnpm run migrate
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const db = openDatabase();
  runMigrations(db);
  db.close();
  console.log("Migrations complete.");
}
