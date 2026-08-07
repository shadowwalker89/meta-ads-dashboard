import { openDatabase, runMigrations } from "@repo/database";
import {
  SqliteAdAccountRepository,
  SqliteCampaignRepository,
  SqliteClientRepository,
  SqliteCollectorJobRepository,
  SqliteInsightSnapshotRepository,
} from "@repo/database";
import { BrowserSessionManager } from "./browser-session-manager.js";
import { PlaywrightCollector } from "./playwright-collector.js";
import { MetricsParser } from "./metrics-parser.js";
import { CollectorOrchestrator } from "./collector-orchestrator.js";

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

  const orchestrator = new CollectorOrchestrator({
    clientRepository: new SqliteClientRepository(db),
    adAccountRepository: new SqliteAdAccountRepository(db),
    campaignRepository: new SqliteCampaignRepository(db),
    collectorJobRepository: new SqliteCollectorJobRepository(db),
    insightSnapshotRepository: new SqliteInsightSnapshotRepository(db),
    collectorProvider,
    metricsParser,
  });

  try {
    await orchestrator.runForAllClients();
  } finally {
    await sessionManager.shutdown();
    db.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
