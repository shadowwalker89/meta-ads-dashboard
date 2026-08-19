import type { Database } from "better-sqlite3";
import { openDatabase } from "./client.js";
import { runMigrations } from "./migrations/migrate.js";
import {
  SqliteAdminAssignmentRepository,
  SqliteAdAccountRepository,
  SqliteCampaignRepository,
  SqliteClientRepository,
  SqliteDashboardPreferenceRepository,
  SqliteInsightSnapshotRepository,
  SqlitePackageRepository,
  SqlitePricingRuleRepository,
  SqliteUserRepository,
} from "./repositories/index.js";
import type {
  Client,
  DashboardKpiKey,
  InsightSnapshot,
  PricingMetric,
  User,
} from "@repo/shared";

/**
 * DEMO SEED — Phase 2I.
 *
 * Creates a fully synthetic, clearly labeled demo dataset so the existing
 * dashboard can be demonstrated end-to-end (client KPI dashboard with
 * non-zero values, finite percentage changes, pricing layer, admin role)
 * WITHOUT any real Meta account, real session, or fake Meta IDs.
 *
 * Scope (LOCAL only, never production data):
 *   - Demo clients: "Demo Silver Client" (Silver package, charts +
 *     dataExport enabled) and "Demo Gold Client" (Gold package).
 *   - Demo users: democlient@example.com (client role, linked to the
 *     Silver demo client). superadmin@example.com / admin1@example.com
 *     come from the baseline seed and are reused.
 *   - Admin assignment: admin1 -> both demo clients.
 *   - Pricing: per-client PricingRule rows (spend/cpc/cpm/costPerResult)
 *     consumed by the existing getClientPricedKpis calculation.
 *   - One labeled demo AdAccount per client (metaAdAccountId = null, so
 *     the collector can never act on it) + 5 synthetic campaigns.
 *   - 4 cumulative InsightSnapshots per campaign at now-1d / -10d / -40d /
 *     -120d. This guarantees every 7/30/90 reporting window has BOTH a
 *     current-period and a previous-period reading, and that all summable
 *     metrics increase monotonically over time -> finite, positive
 *     percentage changes (never the rolling-window null).
 *
 * Idempotent and repeatable: re-running never accumulates rows. The
 * higher-level demo rows (clients, user, assignments, pricing rules, ad
 * accounts, campaigns) are looked up by stable name/email/scrapedLabel
 * and created only when missing; demo InsightSnapshots are always
 * refreshed (delete + re-create for the demo campaigns) so the dataset
 * stays current and identical after every run. `pnpm demo-seed --reset`
 * additionally DELETES all demo-scoped rows (FK order: snapshots,
 * campaigns, ad accounts, pricing rules, admin assignments, KPI
 * preferences, clients, demo user) and rebuilds everything. Reset never
 * touches rows that are not under a demo client.
 *
 * Snapshots are append-only via the repository (no delete method exists),
 * so the reset cleanup uses direct SQL inside this database-package
 * script — the packages/database package owns the SQLite implementation.
 * The client dashboard reads exactly what this script writes through the
 * existing repositories (getClientDashboardData), never through raw SQL.
 */

const DEMO_CLIENT_SILVER_NAME = "Demo Silver Client";
const DEMO_CLIENT_GOLD_NAME = "Demo Gold Client";
const DEMO_CLIENT_EMAIL = "democlient@example.com";
const DEMO_ADMIN_EMAIL = "admin1@example.com";
const DEMO_SILVER_ACCOUNT_NAME = "حساب تبلیغاتی دمو (نقره‌ای)";
const DEMO_GOLD_ACCOUNT_NAME = "حساب تبلیغاتی دمو (طلایی)";

interface CampaignTotals {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  clicksAll: number;
  linkClicks: number;
  uniqueClicks: number;
  landingPageViews: number;
  outboundClicks: number;
  leads: number;
  messagesStarted: number;
  messagesContacts: number;
  results: number;
  postReactions: number;
  postComments: number;
}

interface DemoCampaign {
  label: string;
  name: string;
  objective: string;
  status: string;
  latest: CampaignTotals;
}

const SILVER_CAMPAIGNS: readonly DemoCampaign[] = [
  {
    label: "demo:lead",
    name: "کمپین جذب لید — دمو",
    objective: "LEAD_GENERATION",
    status: "ACTIVE",
    latest: {
      spend: 1280.5,
      impressions: 48250,
      reach: 31900,
      clicks: 3150,
      clicksAll: 3310,
      linkClicks: 2840,
      uniqueClicks: 2620,
      landingPageViews: 1760,
      outboundClicks: 890,
      leads: 412,
      messagesStarted: 95,
      messagesContacts: 38,
      results: 505,
      postReactions: 1240,
      postComments: 210,
    },
  },
  {
    label: "demo:sales",
    name: "کمپین فروش — دمو",
    objective: "SALES",
    status: "ACTIVE",
    latest: {
      spend: 1790.0,
      impressions: 21800,
      reach: 15400,
      clicks: 1240,
      clicksAll: 1305,
      linkClicks: 980,
      uniqueClicks: 1060,
      landingPageViews: 720,
      outboundClicks: 540,
      leads: 180,
      messagesStarted: 210,
      messagesContacts: 96,
      results: 198,
      postReactions: 640,
      postComments: 88,
    },
  },
  {
    label: "demo:brand",
    name: "کمپین آگاهی از برند — دمو",
    objective: "BRAND_AWARENESS",
    status: "ACTIVE",
    latest: {
      spend: 520.25,
      impressions: 97500,
      reach: 76400,
      clicks: 1880,
      clicksAll: 2140,
      linkClicks: 610,
      uniqueClicks: 1720,
      landingPageViews: 340,
      outboundClicks: 280,
      leads: 60,
      messagesStarted: 12,
      messagesContacts: 6,
      results: 66,
      postReactions: 4100,
      postComments: 760,
    },
  },
];

const GOLD_CAMPAIGNS: readonly DemoCampaign[] = [
  {
    label: "demo:engagement",
    name: "کمپین تعامل — دمو",
    objective: "ENGAGEMENT",
    status: "ACTIVE",
    latest: {
      spend: 860.0,
      impressions: 62400,
      reach: 48900,
      clicks: 2940,
      clicksAll: 3180,
      linkClicks: 1550,
      uniqueClicks: 2710,
      landingPageViews: 910,
      outboundClicks: 610,
      leads: 240,
      messagesStarted: 140,
      messagesContacts: 62,
      results: 310,
      postReactions: 5400,
      postComments: 980,
    },
  },
  {
    label: "demo:traffic",
    name: "کمپین ترافیک — دمو",
    objective: "TRAFFIC",
    status: "ACTIVE",
    latest: {
      spend: 410.75,
      impressions: 15300,
      reach: 11200,
      clicks: 2310,
      clicksAll: 2460,
      linkClicks: 2050,
      uniqueClicks: 1970,
      landingPageViews: 1180,
      outboundClicks: 720,
      leads: 85,
      messagesStarted: 30,
      messagesContacts: 14,
      results: 98,
      postReactions: 360,
      postComments: 41,
    },
  },
];

/**
 * Snapshot capturedAt offsets (days before seed-run time) and the
 * cumulative scale for that reading relative to the campaign's latest
 * values. The newest reading (now-1d) is the full current total; older
 * readings are deterministic fractions, strictly increasing toward it so
 * the summable-metric monotonicity guard in the dashboard read never
 * triggers.
 */
const SNAPSHOT_OFFSETS_DAYS: readonly number[] = [1, 10, 40, 120];
const SNAPSHOT_SCALES: readonly number[] = [1.0, 0.61, 0.33, 0.14];

const DEMO_VISIBLE_KPIS: readonly DashboardKpiKey[] = [
  "spend",
  "impressions",
  "reach",
  "frequency",
  "clicks",
  "linkClicks",
  "uniqueClicks",
  "ctr",
  "cpc",
  "cpm",
  "landingPageViews",
  "leads",
  "results",
  "costPerResult",
  "postReactions",
];

interface PricingComponents {
  percentageMarkup: number | null;
  fixedMarkup: number | null;
  minimumCustomerValue: number | null;
}

const SILVER_PRICING: Partial<Record<PricingMetric, PricingComponents>> = {
  spend: { percentageMarkup: 0.2, fixedMarkup: null, minimumCustomerValue: null },
  cpc: { percentageMarkup: 0.15, fixedMarkup: null, minimumCustomerValue: null },
  cpm: { percentageMarkup: null, fixedMarkup: 1.0, minimumCustomerValue: null },
  costPerResult: { percentageMarkup: 0.2, fixedMarkup: null, minimumCustomerValue: null },
};

const GOLD_PRICING: Partial<Record<PricingMetric, PricingComponents>> = {
  spend: { percentageMarkup: 0.3, fixedMarkup: null, minimumCustomerValue: null },
  cpc: { percentageMarkup: 0.1, fixedMarkup: null, minimumCustomerValue: 0.5 },
  cpm: { percentageMarkup: 0.08, fixedMarkup: null, minimumCustomerValue: null },
  costPerResult: { percentageMarkup: 0.25, fixedMarkup: null, minimumCustomerValue: null },
};

const DAY_MS = 24 * 60 * 60 * 1000;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function scaledTotals(latest: CampaignTotals, scale: number): CampaignTotals {
  const result = {} as CampaignTotals;
  for (const [key, value] of Object.entries(latest) as [
    keyof CampaignTotals,
    number,
  ][]) {
    const scaled = value * scale;
    result[key] = key === "spend" ? round2(scaled) : Math.floor(scaled);
  }
  return result;
}

function toSnapshot(
  campaignId: string,
  capturedAt: Date,
  totals: CampaignTotals
): Omit<InsightSnapshot, "id"> {
  const { impressions, reach, clicks, uniqueClicks, outboundClicks, spend, results } =
    totals;
  return {
    campaignId,
    capturedAt,
    // Synthetic demo snapshots carry no real Meta reporting window;
    // null is the honest value (never inferred from capturedAt).
    reportingFrom: null,
    reportingTo: null,
    impressions,
    clicks,
    linkClicks: totals.linkClicks,
    spend,
    ctr: impressions === 0 ? 0 : (clicks / impressions) * 100,
    cpc: clicks === 0 ? 0 : spend / clicks,
    cpm: impressions === 0 ? 0 : (spend * 1000) / impressions,
    reach,
    frequency: reach === 0 ? 0 : impressions / reach,
    clicksAll: totals.clicksAll,
    uniqueClicks,
    uniqueCtr: reach === 0 ? 0 : (uniqueClicks / reach) * 100,
    landingPageViews: totals.landingPageViews,
    outboundClicks,
    outboundCtr: impressions === 0 ? 0 : (outboundClicks / impressions) * 100,
    leads: totals.leads,
    messagesStarted: totals.messagesStarted,
    messagesContacts: totals.messagesContacts,
    results,
    costPerResult: results === 0 ? 0 : spend / results,
    postReactions: totals.postReactions,
    postComments: totals.postComments,
    rawPayload: { source: "demo-seed" },
  };
}

function placeholders(count: number): string {
  return new Array(count).fill("?").join(", ");
}

async function getOrCreateClient(
  clients: SqliteClientRepository,
  name: string,
  packageId: string,
  contactEmail: string
): Promise<Client> {
  const existing = (await clients.list({ limit: 100 })).items.find(
    (c) => c.name === name
  );
  if (existing) return existing;
  return clients.create({
    name,
    businessType: "عمومی (دمو)",
    contactEmail,
    packageId,
    isActive: true,
  });
}

async function getOrCreateAdAccount(
  adAccounts: SqliteAdAccountRepository,
  clientId: string,
  name: string
): Promise<{ id: string }> {
  const existing = (await adAccounts.findByClient(clientId)).find(
    (a) => a.name === name
  );
  if (existing) return existing;
  return adAccounts.create({
    clientId,
    name,
    status: "connected",
    source: "playwright",
    metaAdAccountId: null,
  });
}

async function getOrCreateCampaign(
  campaigns: SqliteCampaignRepository,
  adAccountId: string,
  def: DemoCampaign
): Promise<{ id: string }> {
  const existing = await campaigns.findByAdAccountAndLabel(
    adAccountId,
    def.label
  );
  if (existing) return existing;
  return campaigns.create({
    adAccountId,
    name: def.name,
    objective: def.objective,
    status: def.status,
    scrapedLabel: def.label,
    metaCampaignId: null,
  });
}

async function ensureSnapshots(
  db: Database,
  snapshots: SqliteInsightSnapshotRepository,
  campaignId: string,
  latest: CampaignTotals,
  now: Date
): Promise<void> {
  // Demo snapshots are synthetic and derived, so every run refreshes them:
  // the campaign's existing demo snapshots are removed first, then the
  // current series is appended. This keeps the demo dataset current
  // (dates near the run time), never accumulates duplicates across
  // re-runs, and is strictly scoped to demo campaigns — snapshots of
  // non-demo campaigns are never touched. Same end state after every
  // run, so the seed stays repeatable.
  db.prepare("DELETE FROM insight_snapshots WHERE campaign_id = ?").run(campaignId);
  for (let i = 0; i < SNAPSHOT_OFFSETS_DAYS.length; i++) {
    await snapshots.append(
      toSnapshot(
        campaignId,
        new Date(now.getTime() - SNAPSHOT_OFFSETS_DAYS[i] * DAY_MS),
        scaledTotals(latest, SNAPSHOT_SCALES[i])
      )
    );
  }
}

async function ensurePricing(
  pricing: SqlitePricingRuleRepository,
  client: Client,
  componentsByMetric: Partial<Record<PricingMetric, PricingComponents>>
): Promise<void> {
  const existing = await pricing.findByClient(client.id);
  const existingMetrics = new Set(existing.map((rule) => rule.metric));
  for (const metric of Object.keys(componentsByMetric) as PricingMetric[]) {
    if (existingMetrics.has(metric)) continue;
    const components = componentsByMetric[metric];
    if (!components) continue;
    await pricing.create({
      clientId: client.id,
      metric,
      ...components,
      effectiveFrom: client.packageAssignedAt,
    });
  }
}

function resetDemoRows(db: Database): void {
  const clientRows = db
    .prepare("SELECT id FROM clients WHERE name IN (?, ?)")
    .all(DEMO_CLIENT_SILVER_NAME, DEMO_CLIENT_GOLD_NAME) as { id: string }[];
  const clientIds = clientRows.map((row) => row.id);

  if (clientIds.length === 0) {
    db.prepare("DELETE FROM users WHERE email = ?").run(DEMO_CLIENT_EMAIL);
    return;
  }

  const accountRows = db
    .prepare(
      `SELECT id FROM ad_accounts WHERE client_id IN (${placeholders(clientIds.length)})`
    )
    .all(...clientIds) as { id: string }[];
  const accountIds = accountRows.map((row) => row.id);

  const campaignRows = accountIds.length
    ? (db
        .prepare(
          `SELECT id FROM campaigns WHERE ad_account_id IN (${placeholders(accountIds.length)})`
        )
        .all(...accountIds) as { id: string }[])
    : [];
  const campaignIds = campaignRows.map((row) => row.id);

  if (campaignIds.length) {
    db.prepare(
      `DELETE FROM insight_snapshots WHERE campaign_id IN (${placeholders(campaignIds.length)})`
    ).run(...campaignIds);
  }
  if (campaignIds.length) {
    db.prepare(
      `DELETE FROM campaigns WHERE id IN (${placeholders(campaignIds.length)})`
    ).run(...campaignIds);
  }
  if (accountIds.length) {
    db.prepare(
      `DELETE FROM ad_accounts WHERE id IN (${placeholders(accountIds.length)})`
    ).run(...accountIds);
  }
  if (clientIds.length) {
    db.prepare(
      `DELETE FROM pricing_rules WHERE client_id IN (${placeholders(clientIds.length)})`
    ).run(...clientIds);
  }
  if (clientIds.length) {
    db.prepare(
      `DELETE FROM admin_assignments WHERE client_id IN (${placeholders(clientIds.length)})`
    ).run(...clientIds);
  }
  if (clientIds.length) {
    db.prepare(
      `DELETE FROM dashboard_preferences WHERE client_id IN (${placeholders(clientIds.length)})`
    ).run(...clientIds);
  }
  // The demo client user holds a client_id reference into the demo
  // clients, so it must go before the clients themselves.
  db.prepare("DELETE FROM users WHERE email = ?").run(DEMO_CLIENT_EMAIL);
  if (clientIds.length) {
    db.prepare(
      `DELETE FROM clients WHERE id IN (${placeholders(clientIds.length)})`
    ).run(...clientIds);
  }

  console.log(`Demo reset: removed ${clientIds.length} demo client(s).`);
}

async function main() {
  const reset = process.argv.includes("--reset");
  const db = openDatabase();
  runMigrations(db);

  const users = new SqliteUserRepository(db);
  const clients = new SqliteClientRepository(db);
  const packages = new SqlitePackageRepository(db);
  const assignments = new SqliteAdminAssignmentRepository(db);
  const adAccounts = new SqliteAdAccountRepository(db);
  const campaigns = new SqliteCampaignRepository(db);
  const snapshots = new SqliteInsightSnapshotRepository(db);
  const pricing = new SqlitePricingRuleRepository(db);
  const prefs = new SqliteDashboardPreferenceRepository(db);

  const admin = await users.findByEmail(DEMO_ADMIN_EMAIL);
  if (!admin) {
    throw new Error(
      `Admin user not found: ${DEMO_ADMIN_EMAIL}. Run \`pnpm seed\` first.`
    );
  }
  const silverPkg = await packages.findByCode("silver");
  const goldPkg = await packages.findByCode("gold");
  if (!silverPkg || !goldPkg) {
    throw new Error("Silver/Gold packages not found. Run `pnpm seed` first.");
  }

  if (reset) resetDemoRows(db);

  const silverClient = await getOrCreateClient(
    clients,
    DEMO_CLIENT_SILVER_NAME,
    silverPkg.id,
    "demosilver@example.com"
  );
  const goldClient = await getOrCreateClient(
    clients,
    DEMO_CLIENT_GOLD_NAME,
    goldPkg.id,
    "demogold@example.com"
  );
  const demoClients = [silverClient, goldClient];

  let demoUser: User | null = await users.findByEmail(DEMO_CLIENT_EMAIL);
  if (!demoUser) {
    demoUser = await users.create({
      role: "client",
      fullName: "مشتری دمو",
      email: DEMO_CLIENT_EMAIL,
      clientId: silverClient.id,
    });
  }

  const existingAssignments = await assignments.findByAdmin(admin.id);
  const assignedClientIds = new Set(
    existingAssignments.map((assignment) => assignment.clientId)
  );
  for (const client of demoClients) {
    if (!assignedClientIds.has(client.id)) {
      await assignments.assign(admin.id, client.id);
    }
  }

  await ensurePricing(pricing, silverClient, SILVER_PRICING);
  await ensurePricing(pricing, goldClient, GOLD_PRICING);

  const silverAccount = await getOrCreateAdAccount(
    adAccounts,
    silverClient.id,
    DEMO_SILVER_ACCOUNT_NAME
  );
  const goldAccount = await getOrCreateAdAccount(
    adAccounts,
    goldClient.id,
    DEMO_GOLD_ACCOUNT_NAME
  );

  const now = new Date();
  const seededCampaigns = [
    ...SILVER_CAMPAIGNS.map((def) => ({ def, accountId: silverAccount.id })),
    ...GOLD_CAMPAIGNS.map((def) => ({ def, accountId: goldAccount.id })),
  ];
  let snapshotCount = 0;
  for (const { def, accountId } of seededCampaigns) {
    const campaign = await getOrCreateCampaign(campaigns, accountId, def);
    await ensureSnapshots(db, snapshots, campaign.id, def.latest, now);
    const existing = await snapshots.findRangeForCampaign(
      campaign.id,
      new Date(0),
      now,
      { limit: 100 }
    );
    snapshotCount += existing.items.length;
  }

  await prefs.save({
    userId: null,
    clientId: silverClient.id,
    visibleMetrics: [...DEMO_VISIBLE_KPIS],
    theme: "system",
  });

  console.log("Demo seed complete.");
  console.log(`  Demo clients:      ${demoClients.map((c) => c.name).join(", ")}`);
  console.log(`  Demo client user:  ${DEMO_CLIENT_EMAIL} (client role, Silver demo client)`);
  console.log(`  Admin assignment:  ${DEMO_ADMIN_EMAIL} -> both demo clients`);
  console.log(`  Ad accounts:       ${DEMO_SILVER_ACCOUNT_NAME}, ${DEMO_GOLD_ACCOUNT_NAME}`);
  console.log(`  Campaigns:         ${seededCampaigns.length} (all labeled "دمو")`);
  console.log(
    `  Snapshots:         ${snapshotCount} (${SNAPSHOT_OFFSETS_DAYS.length} per campaign, cumulative)`
  );
  console.log(
    "  Pricing rules:     spend/cpc/cpm/costPerResult per demo client"
  );
  db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});