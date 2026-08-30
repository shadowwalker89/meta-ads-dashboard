import { test } from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import {
  openPostgresDatabase,
  postgresDatabaseFromPool,
} from "../src/client-pg.js";

// The PostgreSQL client is foundation-only in this task: repositories
// arrive later. These tests cover the contract that exists today —
// configuration validation, process-wide pooling, facade semantics and
// lifecycle — without ever opening a real network connection (pg.Pool
// connects lazily on the first query; stub pools keep tests offline).

const DUMMY_URL = "postgres://user:pass@localhost:5432/testdb";

async function withDatabaseUrl<T>(
  url: string | undefined,
  fn: () => Promise<T> | T
): Promise<T> {
  const previous = process.env.DATABASE_URL;
  try {
    if (url === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = url;
    }
    return await fn();
  } finally {
    if (previous === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previous;
    }
  }
}

interface StubQueryResult {
  rows: unknown[];
  rowCount: number | null;
}

/** Minimal offline Pool double mirroring the two members the facade uses. */
function stubPool(result: StubQueryResult = { rows: [], rowCount: 0 }) {
  const calls: { text: string; values?: readonly unknown[] }[] = [];
  let ended = false;
  return {
    calls,
    isEnded: () => ended,
    async query(text: string, values?: unknown[]) {
      calls.push({ text, values });
      return { rows: result.rows, rowCount: result.rowCount, command: "" };
    },
    async end() {
      ended = true;
    },
  };
}

test("client-pg: missing DATABASE_URL fails with a concise configuration error", async () => {
  await withDatabaseUrl(undefined, () => {
    assert.throws(
      () => openPostgresDatabase(),
      (error: unknown) =>
        error instanceof Error &&
        error.message.startsWith(
          "DATABASE_URL is required for the PostgreSQL provider."
        )
    );
  });
});

test("client-pg: the no-argument handle is memoized per process", async () => {
  await withDatabaseUrl(DUMMY_URL, async () => {
    const first = openPostgresDatabase();
    const second = openPostgresDatabase();
    assert.equal(first, second);
    // Closing the shared handle clears the slot; the next call rebuilds
    // a fresh handle instead of reusing the closed one.
    await first.close();
    const third = openPostgresDatabase();
    assert.notEqual(third, first);
    await third.close();
  });
});

test("client-pg: explicit options always build an independent handle", async () => {
  const a = openPostgresDatabase({ connectionString: DUMMY_URL });
  const b = openPostgresDatabase({ connectionString: DUMMY_URL });
  assert.notEqual(a, b);
  await a.close();
  await b.close();
});

test("client-pg facade: query returns every row", async () => {
  const pool = stubPool({ rows: [{ id: "a" }, { id: "b" }], rowCount: 2 });
  const db = postgresDatabaseFromPool(pool as unknown as Pool);

  const rows = await db.query<{ id: string }>("SELECT * FROM t", ["x"]);
  assert.deepEqual(rows, [{ id: "a" }, { id: "b" }]);
  assert.equal(pool.calls.length, 1);
  assert.equal(pool.calls[0].text, "SELECT * FROM t");
  assert.deepEqual(pool.calls[0].values, ["x"]);
  assert.equal(pool.isEnded(), false);
});

test("client-pg facade: queryOne returns the first row or null", async () => {
  const emptyPool = stubPool({ rows: [], rowCount: 0 });
  const somePool = stubPool({
    rows: [{ count: "7" }],
    rowCount: 1,
  });

  const none = await postgresDatabaseFromPool(
    emptyPool as unknown as Pool
  ).queryOne<{ count: string }>("SELECT count(*) AS count FROM t");
  assert.equal(none, null);

  const one = await postgresDatabaseFromPool(
    somePool as unknown as Pool
  ).queryOne<{ count: string }>("SELECT count(*) AS count FROM t");
  assert.deepEqual(one, { count: "7" }); // BIGINT arrives as a string.
});

test("client-pg facade: execute returns the affected-row count", async () => {
  const pool = stubPool({ rows: [], rowCount: 3 });
  const db = postgresDatabaseFromPool(pool as unknown as Pool);

  const affected = await db.execute("DELETE FROM t WHERE id = $1", ["a"]);
  assert.equal(affected, 3);
});

test("client-pg facade: close ends the pool exactly once", async () => {
  const pool = stubPool();
  const db = postgresDatabaseFromPool(pool as unknown as Pool);

  await db.close();
  assert.equal(pool.isEnded(), true);
});
