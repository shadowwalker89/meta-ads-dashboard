import { test } from "node:test";
import assert from "node:assert/strict";
import type { PostgresDatabase, RepositoryBundle, StorageHandle } from "@repo/database";
import { openDatabase } from "@repo/database";
import { openCollectorStorage, type CollectorStorageDependencies } from "../src/database.js";

type SqliteDatabase = ReturnType<typeof openDatabase>;

function fakeSqlite(close: () => void): SqliteDatabase {
  return { close } as unknown as SqliteDatabase;
}

function fakePostgres(close: () => Promise<void>): PostgresDatabase {
  return {
    pool: {} as PostgresDatabase["pool"],
    query: async () => [],
    queryOne: async () => null,
    execute: async () => 0,
    close,
  };
}

function makeDependencies(overrides: Partial<CollectorStorageDependencies> = {}) {
  const calls = {
    sqliteOpened: 0,
    sqliteMigrated: 0,
    postgresOpened: 0,
    repositoriesCreated: 0,
    sqliteClosed: 0,
    postgresClosed: 0,
  };
  const sqlite = fakeSqlite(() => { calls.sqliteClosed += 1; });
  const postgres = fakePostgres(async () => { calls.postgresClosed += 1; });
  const base: CollectorStorageDependencies = {
    openSqlite: () => { calls.sqliteOpened += 1; return sqlite; },
    runSqliteMigrations: () => { calls.sqliteMigrated += 1; },
    openPostgres: () => { calls.postgresOpened += 1; return postgres; },
    createRepositories: () => { calls.repositoriesCreated += 1; return {} as RepositoryBundle; },
  };
  return { calls, dependencies: { ...base, ...overrides } };
}

test("collector storage: sqlite selects sqlite initialization and closes it", async () => {
  const { calls, dependencies } = makeDependencies();
  const storage = await openCollectorStorage({ DATABASE_PROVIDER: "sqlite" }, dependencies);

  assert.equal(storage.provider, "sqlite");
  assert.equal(calls.sqliteOpened, 1);
  assert.equal(calls.sqliteMigrated, 1);
  assert.equal(calls.postgresOpened, 0);
  assert.equal(calls.repositoriesCreated, 1);

  await storage.close();
  await storage.close();
  assert.equal(calls.sqliteClosed, 1);
  assert.equal(calls.postgresClosed, 0);
});

test("collector storage: supabase skips sqlite and closes postgres", async () => {
  const { calls, dependencies } = makeDependencies();
  const storage = await openCollectorStorage({ DATABASE_PROVIDER: "supabase" }, dependencies);

  assert.equal(storage.provider, "supabase");
  assert.equal(calls.sqliteOpened, 0);
  assert.equal(calls.sqliteMigrated, 0);
  assert.equal(calls.postgresOpened, 1);
  assert.equal(calls.repositoriesCreated, 1);

  await storage.close();
  await storage.close();
  assert.equal(calls.sqliteClosed, 0);
  assert.equal(calls.postgresClosed, 1);
});

test("collector storage: failed repository construction closes the selected handle", async () => {
  const { calls, dependencies } = makeDependencies({
    createRepositories: (_handle: StorageHandle) => { throw new Error("repository setup failed"); },
  });

  await assert.rejects(
    () => openCollectorStorage({ DATABASE_PROVIDER: "sqlite" }, dependencies),
    /repository setup failed/
  );
  assert.equal(calls.sqliteClosed, 1);
  assert.equal(calls.postgresClosed, 0);
});
