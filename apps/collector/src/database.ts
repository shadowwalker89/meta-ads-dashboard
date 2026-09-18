import {
  createRepositories,
  openDatabase,
  openPostgresDatabase,
  resolveDatabaseProvider,
  runMigrations,
  type DatabaseProviderEnv,
  type DatabaseProviderName,
  type PostgresDatabase,
  type RepositoryBundle,
  type StorageHandle,
} from "@repo/database";

type SqliteDatabase = ReturnType<typeof openDatabase>;

export interface CollectorStorage {
  provider: DatabaseProviderName;
  repositories: RepositoryBundle;
  close: () => Promise<void>;
}

export interface CollectorStorageDependencies {
  openSqlite: () => SqliteDatabase;
  runSqliteMigrations: (db: SqliteDatabase) => void;
  openPostgres: () => PostgresDatabase;
  createRepositories: (
    handle: StorageHandle,
    env: DatabaseProviderEnv
  ) => RepositoryBundle;
}

const defaultDependencies: CollectorStorageDependencies = {
  openSqlite: openDatabase,
  runSqliteMigrations: runMigrations,
  openPostgres: openPostgresDatabase,
  createRepositories,
};

export async function openCollectorStorage(
  env: DatabaseProviderEnv = process.env,
  dependencies: CollectorStorageDependencies = defaultDependencies
): Promise<CollectorStorage> {
  const provider = resolveDatabaseProvider(env);
  let handle: StorageHandle | undefined;

  try {
    if (provider === "sqlite") {
      const db = dependencies.openSqlite();
      handle = db;
      dependencies.runSqliteMigrations(db);
    } else {
      handle = dependencies.openPostgres();
    }

    if (!handle) {
      throw new Error("Collector storage handle was not initialized.");
    }

    const repositories = dependencies.createRepositories(handle, env);
    let closed = false;

    return {
      provider,
      repositories,
      close: async () => {
        if (closed || !handle) return;
        closed = true;
        if (provider === "sqlite") {
          handle.close();
        } else {
          await handle.close();
        }
      },
    };
  } catch (error) {
    if (handle) {
      if (provider === "sqlite") {
        handle.close();
      } else {
        await handle.close();
      }
    }
    throw error;
  }
}
