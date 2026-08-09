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
           (id, campaign_id, captured_at, impressions, clicks, link_clicks, spend, ctr, cpc, cpm, reach, raw_payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
