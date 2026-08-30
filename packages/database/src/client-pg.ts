import { Pool, type PoolConfig } from "pg";

/**
 * Server-only PostgreSQL client layer ("the Supabase connection").
 *
 * Mirrors src/client.ts responsibilities for the PostgreSQL provider:
 *   - one lazily-connected Pool per application process (the memoized
 *     default handle below); repositories receive this SAME handle from
 *     createRepositories(), never their own pools;
 *   - credentials come exclusively from DATABASE_URL / process env —
 *     nothing here is importable by client-side code;
 *   - no TCP connection is opened until the first query (pg.Pool is
 *     lazy), so constructing the handle is always side-effect-free.
 *
 * Connection style: Supavisor SESSION mode (port 5432) via a standard
 * postgres://DATABASE_URL with TLS — the simplest safe option for a
 * long-lived Node server (VPS/local), not a browser client.
 */

/** Shape repositories will program against (kept deliberately small). */
export interface PostgresDatabase {
  /** Runs a parameterized statement and returns every resulting row. */
  query<R>(text: string, values?: readonly unknown[]): Promise<R[]>;
  /** Runs a parameterized statement; first row or null (SELECT ... LIMIT 1). */
  queryOne<R>(text: string, values?: readonly unknown[]): Promise<R | null>;
  /** Runs a parameterized write; returns the affected-row count. */
  execute(text: string, values?: readonly unknown[]): Promise<number>;
  /** Closes the underlying pool (graceful shutdown / tests only). */
  close(): Promise<void>;
  /** Escape hatch for future needs (e.g. explicit transactions). */
  readonly pool: Pool;
}

export interface OpenPostgresDatabaseOptions {
  /** Defaults to the DATABASE_URL environment variable. */
  connectionString?: string;
  /** Overrides the default Supabase-appropriate TLS behavior. */
  ssl?: PoolConfig["ssl"];
  /** Overrides pg's default max connections per process. */
  max?: number;
}

/**
 * TLS is required by Supabase. rejectUnauthorized=false matches
 * Supabase's own Node/postgres guidance (pooler certificates are not
 * signed by a CA Node trusts); an explicit opt-out stays available via
 * PGSSLMODE=disable for local non-TLS PostgreSQL instances.
 */
function resolveSsl(options: OpenPostgresDatabaseOptions): PoolConfig["ssl"] {
  if (options.ssl !== undefined) return options.ssl;
  if ((process.env.PGSSLMODE ?? "").trim().toLowerCase() === "disable") {
    return undefined;
  }
  return { rejectUnauthorized: false };
}

function createPool(options: OpenPostgresDatabaseOptions): Pool {
  const connectionString =
    options.connectionString ??
    process.env.DATABASE_URL?.trim() ??
    "";
  if (connectionString === "") {
    throw new Error(
      "DATABASE_URL is required for the PostgreSQL provider. Set it to the Supabase session-mode connection string (postgres://...)."
    );
  }
  const config: PoolConfig = {
    connectionString,
    ssl: resolveSsl(options),
    ...(options.max !== undefined ? { max: options.max } : {}),
  };
  return new Pool(config);
}

/**
 * Wraps an existing pg.Pool in the typed repository-facing facade.
 * Exported separately from openPostgresDatabase so future
 * transaction-scoped clients (pool.connect()) can reuse the exact same
 * API without new plumbing.
 */
export function postgresDatabaseFromPool(
  pool: Pool,
  onClosed?: () => void
): PostgresDatabase {
  return {
    pool,
    async query<R>(text: string, values?: readonly unknown[]): Promise<R[]> {
      const result = await pool.query(text, values as unknown[]);
      return result.rows as R[];
    },
    async queryOne<R>(
      text: string,
      values?: readonly unknown[]
    ): Promise<R | null> {
      const result = await pool.query(text, values as unknown[]);
      return (result.rows[0] as R | undefined) ?? null;
    },
    async execute(text: string, values?: readonly unknown[]): Promise<number> {
      const result = await pool.query(text, values as unknown[]);
      return result.rowCount ?? 0;
    },
    async close(): Promise<void> {
      // Clear the memoized slot BEFORE ending the pool so a subsequent
      // openPostgresDatabase() builds a fresh handle instead of reusing
      // a closed one.
      onClosed?.();
      await pool.end();
    },
  };
}

// The memoized default handle keeps "one Pool per process" true even if
// several modules call openPostgresDatabase() without arguments. Calls
// with EXPLICIT options always build a fresh instance (tests, tools).
let defaultHandle: PostgresDatabase | null = null;

/**
 * Opens the PostgreSQL handle. Without options this returns the shared
 * process-wide handle (created once, connected lazily); with explicit
 * options it returns an independent instance whose lifetime the caller
 * owns.
 */
export function openPostgresDatabase(
  options: OpenPostgresDatabaseOptions = {}
): PostgresDatabase {
  const hasExplicitConfig =
    options.connectionString !== undefined ||
    options.ssl !== undefined ||
    options.max !== undefined;

  if (!hasExplicitConfig) {
    if (!defaultHandle) {
      defaultHandle = postgresDatabaseFromPool(createPool({}), () => {
        defaultHandle = null;
      });
    }
    return defaultHandle;
  }

  return postgresDatabaseFromPool(createPool(options));
}
