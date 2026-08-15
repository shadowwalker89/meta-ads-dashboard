import type { Database } from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type {
  InsightSnapshot,
  InsightSnapshotRepository,
  PageRequest,
  PageResult,
} from "@repo/shared";

interface InsightSnapshotRow {
  id: string;
  campaign_id: string;
  captured_at: string;
  impressions: number;
  clicks: number;
  link_clicks: number;
  spend: number;
  ctr: number;
  cpc: number;
  cpm: number;
  reach: number;
  frequency: number;
  clicks_all: number;
  unique_clicks: number;
  unique_ctr: number;
  landing_page_views: number;
  outbound_clicks: number;
  outbound_ctr: number;
  leads: number;
  messages_started: number;
  messages_contacts: number;
  results: number;
  cost_per_result: number;
  post_reactions: number;
  post_comments: number;
  raw_payload: string | null;
}

function toDomain(row: InsightSnapshotRow): InsightSnapshot {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    capturedAt: new Date(row.captured_at),
    impressions: row.impressions,
    clicks: row.clicks,
    linkClicks: row.link_clicks,
    spend: row.spend,
    ctr: row.ctr,
    cpc: row.cpc,
    cpm: row.cpm,
    reach: row.reach,
    frequency: row.frequency ?? 0,
    clicksAll: row.clicks_all ?? 0,
    uniqueClicks: row.unique_clicks ?? 0,
    uniqueCtr: row.unique_ctr ?? 0,
    landingPageViews: row.landing_page_views ?? 0,
    outboundClicks: row.outbound_clicks ?? 0,
    outboundCtr: row.outbound_ctr ?? 0,
    leads: row.leads ?? 0,
    messagesStarted: row.messages_started ?? 0,
    messagesContacts: row.messages_contacts ?? 0,
    results: row.results ?? 0,
    costPerResult: row.cost_per_result ?? 0,
    postReactions: row.post_reactions ?? 0,
    postComments: row.post_comments ?? 0,
    rawPayload: row.raw_payload ? JSON.parse(row.raw_payload) : null,
  };
}

export class SqliteInsightSnapshotRepository implements InsightSnapshotRepository {
  constructor(private readonly db: Database) {}

  async append(snapshot: Omit<InsightSnapshot, "id">): Promise<InsightSnapshot> {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO insight_snapshots
           (id, campaign_id, captured_at,
            impressions, clicks, link_clicks, spend, ctr, cpc, cpm, reach,
            frequency, clicks_all, unique_clicks, unique_ctr,
            landing_page_views, outbound_clicks, outbound_ctr,
            leads, messages_started, messages_contacts, results, cost_per_result,
            post_reactions, post_comments,
            raw_payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        snapshot.campaignId,
        snapshot.capturedAt.toISOString(),
        snapshot.impressions,
        snapshot.clicks,
        snapshot.linkClicks,
        snapshot.spend,
        snapshot.ctr,
        snapshot.cpc,
        snapshot.cpm,
        snapshot.reach,
        snapshot.frequency ?? 0,
        snapshot.clicksAll ?? 0,
        snapshot.uniqueClicks ?? 0,
        snapshot.uniqueCtr ?? 0,
        snapshot.landingPageViews ?? 0,
        snapshot.outboundClicks ?? 0,
        snapshot.outboundCtr ?? 0,
        snapshot.leads ?? 0,
        snapshot.messagesStarted ?? 0,
        snapshot.messagesContacts ?? 0,
        snapshot.results ?? 0,
        snapshot.costPerResult ?? 0,
        snapshot.postReactions ?? 0,
        snapshot.postComments ?? 0,
        snapshot.rawPayload ? JSON.stringify(snapshot.rawPayload) : null
      );
    return { id, ...snapshot };
  }

  async findLatestForCampaign(campaignId: string): Promise<InsightSnapshot | null> {
    const row = this.db
      .prepare(
        `SELECT * FROM insight_snapshots
         WHERE campaign_id = ?
         ORDER BY captured_at DESC
         LIMIT 1`
      )
      .get(campaignId) as InsightSnapshotRow | undefined;
    return row ? toDomain(row) : null;
  }

  async findRangeForCampaign(
    campaignId: string,
    from: Date,
    to: Date,
    page: PageRequest
  ): Promise<PageResult<InsightSnapshot>> {
    const offset = page.cursor ? parseInt(page.cursor, 10) : 0;
    const rows = this.db
      .prepare(
        `SELECT * FROM insight_snapshots
         WHERE campaign_id = ? AND captured_at BETWEEN ? AND ?
         ORDER BY captured_at
         LIMIT ? OFFSET ?`
      )
      .all(
        campaignId,
        from.toISOString(),
        to.toISOString(),
        page.limit,
        offset
      ) as InsightSnapshotRow[];
    const items = rows.map(toDomain);
    const nextCursor = items.length === page.limit ? String(offset + page.limit) : null;
    return { items, nextCursor };
  }
}
