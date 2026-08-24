import { createRepositories, openDatabase, runMigrations } from "@repo/database";
import { SqlitePackageEnforcement } from "@repo/database";
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

  // The single storage-provider seam: repositories come from the
  // factory (DATABASE_PROVIDER selects the backend; sqlite is the
  // default), never from direct Sqlite* construction here.
  const repos = createRepositories(db);

  const orchestrator = new CollectorOrchestrator({
    clientRepository: repos.clientRepository,
    adAccountRepository: repos.adAccountRepository,
    campaignRepository: repos.campaignRepository,
    collectorJobRepository: repos.collectorJobRepository,
    insightSnapshotRepository: repos.insightSnapshotRepository,
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
    clientRepository: repos.clientRepository,
    adAccountRepository: repos.adAccountRepository,
    packageRepository: repos.packageRepository,
    collectorJobRepository: repos.collectorJobRepository,
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
