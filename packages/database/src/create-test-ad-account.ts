import { openDatabase } from "./client.js";
import { runMigrations } from "./migrations/migrate.js";
import { SqliteClientRepository, SqliteAdAccountRepository } from "./repositories/index.js";

/**
 * One-off script — NOT part of seed.ts. Creating an AdAccount is a
 * real admin action (in production this will happen from the Admin
 * panel, once it exists); it doesn't belong in the repeatable
 * baseline seed. Run this manually, once, to unblock Collector
 * testing until that panel exists.
 */
async function main() {
  const db = openDatabase();
  runMigrations(db);

  const clients = new SqliteClientRepository(db);
  const adAccounts = new SqliteAdAccountRepository(db);

  const page = await clients.list({ limit: 1 });
  const client = page.items[0];

  if (!client) {
    console.error(
      "No Client found. Run `pnpm run seed` first (in packages/database) to create the baseline clients."
    );
    process.exit(1);
  }

  const adAccount = await adAccounts.create({
    clientId: client.id,
    name: "Test Ad Account",
    status: "pending",
    source: "playwright",
    metaAdAccountId: null,
  });

  console.log("Created test AdAccount:");
  console.log(`  id:       ${adAccount.id}`);
  console.log(`  clientId: ${adAccount.clientId}  (client name: ${client.name})`);
  console.log(`  status:   ${adAccount.status}`);
  console.log(`  source:   ${adAccount.source}`);

  db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
