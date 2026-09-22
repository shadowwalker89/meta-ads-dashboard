// Next.js server startup hook (docs: instrumentationHook). register()
// runs once per server process before it begins serving requests, so
// awaiting prepareDatabase() here guarantees the PostgreSQL schema is
// migrated before the first database-dependent request reaches the
// repositories. SQLite needs nothing here: getDatabase() migrates
// synchronously on first use, unchanged.

import { prepareDatabase } from "./lib/db";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  await prepareDatabase();
}
