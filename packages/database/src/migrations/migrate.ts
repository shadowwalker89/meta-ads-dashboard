import type Database from "better-sqlite3";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "../client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// PRAGMA statements (journal_mode, foreign_keys, ...) cannot run inside
// a transaction. None of the migrations below use them — connection
// PRAGMAs are set in openDatabase() (src/client.ts) before migrations
// ever run, so this is a documented constraint, not a workaround.
const ALTER_ADD_COLUMN_RE =
  /^\s*ALTER\s+TABLE\s+([a-z_][a-z0-9_]*)\s+ADD\s+COLUMN\s+([a-z_][a-z0-9_]*)/i;

/**
 * Splits a migration file into individual SQL statements.
 *
 * Handles `--` line comments and single-quoted string literals (with
 * `''` escapes) so that semicolons inside strings or comments never
 * split a statement. Splitting is needed because ALTER TABLE ...
 * ADD COLUMN statements must be skipped individually when the column
 * already exists (SQLite has no `ADD COLUMN IF NOT EXISTS`).
 */
function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inString = false;
  let inComment = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (inComment) {
      if (ch === "\n") {
        inComment = false;
        current += " ";
      }
      continue;
    }

    if (inString) {
      current += ch;
      if (ch === "'") {
        if (next === "'") {
          current += next;
          i++;
        } else {
          inString = false;
        }
      }
      continue;
    }

    if (ch === "-" && next === "-") {
      inComment = true;
      i++;
      continue;
    }

    if (ch === "'") {
      inString = true;
      current += ch;
      continue;
    }

    if (ch === ";") {
      const statement = current.trim();
      if (statement.length > 0) statements.push(statement);
      current = "";
      continue;
    }

    current += ch;
  }

  const tail = current.trim();
  if (tail.length > 0) statements.push(tail);
  return statements;
}

function columnExists(
  db: Database.Database,
  table: string,
  column: string
): boolean {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
  }[];
  return columns.some((row) => row.name === column);
}

/**
 * Runs every *.sql file in this folder, in filename order, exactly once.
 * Applied migrations are tracked in the _migrations table, so running
 * this multiple times is safe (already-applied files are skipped).
 *
 * Each migration is applied inside a single transaction:
 *   - a failing migration rolls back completely and is NOT recorded, so
 *     the database is never left partially migrated while _migrations
 *     says it was not applied;
 *   - `ALTER TABLE ... ADD COLUMN` statements whose column already
 *     exists are skipped instead of failing, so a migration can safely
 *     re-run against a database that already contains its schema
 *     (SQLite has no `ADD COLUMN IF NOT EXISTS`).
 */
export function runMigrations(
  db: Database.Database,
  migrationsDir: string = __dirname
): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name       TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const alreadyApplied = new Set(
    (db.prepare("SELECT name FROM _migrations").all() as { name: string }[]).map(
      (row) => row.name
    )
  );

  for (const file of files) {
    if (alreadyApplied.has(file)) continue;

    const sql = readFileSync(join(migrationsDir, file), "utf-8");
    const statements = splitStatements(sql);

    const apply = db.transaction(() => {
      for (const statement of statements) {
        const match = ALTER_ADD_COLUMN_RE.exec(statement);
        if (
          match &&
          columnExists(db, match[1], match[2])
        ) {
          console.log(
            `Skipping ALTER ADD COLUMN (column already exists): ${file} :: ${match[1]}.${match[2]}`
          );
          continue;
        }
        db.exec(statement);
      }

      db.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)").run(
        file,
        new Date().toISOString()
      );
    });

    apply();
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