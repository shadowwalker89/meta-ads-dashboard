import { openDatabase } from "./client.js";
import { runMigrations } from "./migrations/migrate.js";
import {
  SqliteClientRepository,
  SqliteAdAccountRepository,
  SqliteCampaignRepository,
  SqliteInsightSnapshotRepository,
} from "./repositories/index.js";

const TEST_AD_ACCOUNT_NAME = "Test Dashboard Account";
const TEST_AD_ACCOUNT_META_ID = "test-meta-account-001";
const TEST_CAMPAIGN_META_ID = "test-meta-campaign-001";
const TEST_CAMPAIGN_LABEL = "Test Dashboard Campaign (test data)";
const TEST_CAPTURED_AT = new Date("2026-01-01T00:00:00.000Z");

/**
 * One-off script — NOT part of seed.ts. Creates a deterministic
 * Client 1 → AdAccount → Campaign → InsightSnapshot chain so the
 * Dashboard KPI path can be verified end-to-end. Idempotent: re-running
 * never duplicates rows; it only fills in whatever part is missing.
 */
async function main() {
  const db = openDatabase();
  runMigrations(db);

  const clients = new SqliteClientRepository(db);
  const adAccounts = new SqliteAdAccountRepository(db);
  const campaigns = new SqliteCampaignRepository(db);
  const snapshots = new SqliteInsightSnapshotRepository(db);

  const seededClients = (await clients.list({ limit: 100 })).items;
  const client1 = seededClients.find((c) => c.name === "Client 1");
  if (!client1) {
    console.error(
      'Client 1 not found. Run `pnpm seed` first (in packages/database) to create the baseline clients.'
    );
    process.exit(1);
  }

  const existingAccounts = await adAccounts.findByClient(client1.id);
  const adAccount = existingAccounts.find(
    (a) =>
      a.name === TEST_AD_ACCOUNT_NAME || a.metaAdAccountId === TEST_AD_ACCOUNT_META_ID
  );

  if (adAccount) {
    const accountCampaigns = await campaigns.findByAdAccount(adAccount.id);
    const campaign = accountCampaigns.find(
      (c) =>
        c.metaCampaignId === TEST_CAMPAIGN_META_ID ||
        c.scrapedLabel === TEST_CAMPAIGN_LABEL
    );

    if (campaign) {
      const latest = await snapshots.findLatestForCampaign(campaign.id);
      if (latest) {
        console.log("Dashboard test data already exists — nothing to create.");
        db.close();
        return;
      }

      await snapshots.append({
        campaignId: campaign.id,
        capturedAt: TEST_CAPTURED_AT,
        reportingFrom: null,
        reportingTo: null,
        impressions: 10000,
        clicks: 500,
        linkClicks: 400,
        spend: 125,
        ctr: 5,
        cpc: 0.25,
        cpm: 12.5,
        reach: 8000,
        frequency: 0,
        clicksAll: 0,
        uniqueClicks: 0,
        uniqueCtr: 0,
        landingPageViews: 0,
        outboundClicks: 0,
        outboundCtr: 0,
        leads: 0,
        messagesStarted: 0,
        messagesContacts: 0,
        results: 0,
        costPerResult: 0,
        postReactions: 0,
        postComments: 0,
        rawPayload: { test: true, source: "create-test-data" },
      });
      console.log("Created missing test InsightSnapshot for existing Campaign.");
      db.close();
      return;
    }

    const createdCampaign = await campaigns.create({
      adAccountId: adAccount.id,
      name: "Test Dashboard Campaign",
      objective: "TRAFFIC",
      status: "ACTIVE",
      scrapedLabel: TEST_CAMPAIGN_LABEL,
      metaCampaignId: TEST_CAMPAIGN_META_ID,
    });
    await snapshots.append({
      campaignId: createdCampaign.id,
      capturedAt: TEST_CAPTURED_AT,
      reportingFrom: null,
      reportingTo: null,
      impressions: 10000,
      clicks: 500,
      linkClicks: 400,
      spend: 125,
      ctr: 5,
      cpc: 0.25,
      cpm: 12.5,
      reach: 8000,
      frequency: 0,
      clicksAll: 0,
      uniqueClicks: 0,
      uniqueCtr: 0,
      landingPageViews: 0,
      outboundClicks: 0,
      outboundCtr: 0,
      leads: 0,
      messagesStarted: 0,
      messagesContacts: 0,
      results: 0,
      costPerResult: 0,
      postReactions: 0,
      postComments: 0,
      rawPayload: { test: true, source: "create-test-data" },
    });
    console.log("Created missing test Campaign and InsightSnapshot.");
    db.close();
    return;
  }

  const createdAdAccount = await adAccounts.create({
    clientId: client1.id,
    name: TEST_AD_ACCOUNT_NAME,
    status: "pending",
    source: "playwright",
    metaAdAccountId: TEST_AD_ACCOUNT_META_ID,
  });
  const createdCampaign = await campaigns.create({
    adAccountId: createdAdAccount.id,
    name: "Test Dashboard Campaign",
    objective: "TRAFFIC",
    status: "ACTIVE",
    scrapedLabel: TEST_CAMPAIGN_LABEL,
    metaCampaignId: TEST_CAMPAIGN_META_ID,
  });
  await snapshots.append({
    campaignId: createdCampaign.id,
    capturedAt: TEST_CAPTURED_AT,
    reportingFrom: null,
    reportingTo: null,
    impressions: 10000,
    clicks: 500,
    linkClicks: 400,
    spend: 125,
    ctr: 5,
    cpc: 0.25,
    cpm: 12.5,
reach: 8000,
      frequency: 0,
      clicksAll: 0,
      uniqueClicks: 0,
      uniqueCtr: 0,
      landingPageViews: 0,
      outboundClicks: 0,
      outboundCtr: 0,
      leads: 0,
      messagesStarted: 0,
      messagesContacts: 0,
      results: 0,
      costPerResult: 0,
      postReactions: 0,
      postComments: 0,
      rawPayload: { test: true, source: "create-test-data" },
    });

    console.log("Created test AdAccount, Campaign, and InsightSnapshot:");
  console.log(`  adAccountId: ${createdAdAccount.id}`);
  console.log(`  campaignId:  ${createdCampaign.id}`);
  db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});