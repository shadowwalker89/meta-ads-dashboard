import { openDatabase, runMigrations } from "@repo/database";
import {
  SqliteAdAccountRepository,
  SqliteCampaignRepository,
  SqliteClientRepository,
  SqliteCollectorJobRepository,
  SqliteInsightSnapshotRepository,
  SqlitePackageEnforcement,
  SqlitePackageRepository,
} from "@repo/database";
import { BrowserSessionManager } from "./browser-session-manager.js";
import { PlaywrightCollector } from "./playwright-collector.js";
import { MetricsParser } from "./metrics-parser.js";
import { CollectorOrchestrator } from "./collector-orchestrator.js";
import { CollectionScheduler } from "./collection-scheduler.js";

async function main() {
  const db = openDatabase();
  runMigrations(db);

  // Every dependency is constructed here, once, and passed down
  // explicitly. Nothing is a module-level singleton — swapping
  // PlaywrightCollector for a future MetaApiCollector means changing
  // exactly these few lines, nothing else in the codebase.
  const sessionManager = new BrowserSessionManager();
  const collectorProvider = new PlaywrightCollector(sessionManager);
  const metricsParser = new MetricsParser();
  const packageEnforcement = new SqlitePackageEnforcement(db);

  const orchestrator = new CollectorOrchestrator({
    clientRepository: new SqliteClientRepository(db),
    adAccountRepository: new SqliteAdAccountRepository(db),
    campaignRepository: new SqliteCampaignRepository(db),
    collectorJobRepository: new SqliteCollectorJobRepository(db),
    insightSnapshotRepository: new SqliteInsightSnapshotRepository(db),
    collectorProvider,
    metricsParser,
    packageEnforcement,
  });

  // The scheduler decides which ad accounts are due (per the client's
  // package collectionFrequency + latest CollectorJob) and invokes the
  // orchestrator for exactly those. It is a plain callable service, so
  // an external cron/Task Scheduler/GH Action can invoke the same path
  // later without any change here.
  const scheduler = new CollectionScheduler({
    clientRepository: new SqliteClientRepository(db),
    adAccountRepository: new SqliteAdAccountRepository(db),
    packageRepository: new SqlitePackageRepository(db),
    collectorJobRepository: new SqliteCollectorJobRepository(db),
    orchestrator,
  });

  try {
    const result = await scheduler.runDueCollections();
    console.log(
      `[Scheduler] evaluated=${result.evaluated} collected=${result.collected} skipped=${result.skipped}`
    );
  } finally {
    await sessionManager.shutdown();
    db.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
