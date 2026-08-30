import { randomUUID } from "node:crypto";
import type { PostgresDatabase } from "../client-pg.js";
import {
  formatReportingDate,
  parseReportingDate,
  type InsightSnapshot,
  type InsightSnapshotRepository,
  type PageRequest,
  type PageResult,
} from "@repo/shared";
import {
  bigIntColumn,
  jsonbColumn,
  jsonbParam,
  timestampColumn,
} from "./pg-row-convert.js";

interface InsightSnapshotRow {
  id: string;
  campaign_id: string;
  captured_at: unknown;
  reporting_from: string | null;
  reporting_to: string | null;
  impressions: unknown;
  clicks: unknown;
  link_clicks: unknown;
  spend: number;
  ctr: number;
  cpc: number;
  cpm: number;
  reach: unknown;
  frequency: number;
  clicks_all: unknown;
  unique_clicks: unknown;
  unique_ctr: number;
  landing_page_views: unknown;
  outbound_clicks: unknown;
  outbound_ctr: number;
  leads: unknown;
  messages_started: unknown;
  messages_contacts: unknown;
  results: unknown;
  cost_per_result: number;
  post_reactions: unknown;
  post_comments: unknown;
  raw_payload: unknown;
}

function toDomain(row: InsightSnapshotRow): InsightSnapshot {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    capturedAt: timestampColumn(row.captured_at, "captured_at"),
    reportingFrom: parseReportingDate(row.reporting_from),
    reportingTo: parseReportingDate(row.reporting_to),
    impressions: bigIntColumn(row.impressions, "impressions"),
    clicks: bigIntColumn(row.clicks, "clicks"),
    linkClicks: bigIntColumn(row.link_clicks, "link_clicks"),
    spend: row.spend,
    ctr: row.ctr,
    cpc: row.cpc,
    cpm: row.cpm,
    reach: bigIntColumn(row.reach, "reach"),
    frequency: row.frequency ?? 0,
    clicksAll: bigIntColumn(row.clicks_all ?? 0, "clicks_all"),
    uniqueClicks: bigIntColumn(row.unique_clicks ?? 0, "unique_clicks"),
    uniqueCtr: row.unique_ctr ?? 0,
    landingPageViews: bigIntColumn(
      row.landing_page_views ?? 0,
      "landing_page_views"
    ),
    outboundClicks: bigIntColumn(row.outbound_clicks ?? 0, "outbound_clicks"),
    outboundCtr: row.outbound_ctr ?? 0,
    leads: bigIntColumn(row.leads ?? 0, "leads"),
    messagesStarted: bigIntColumn(row.messages_started ?? 0, "messages_started"),
    messagesContacts: bigIntColumn(
      row.messages_contacts ?? 0,
      "messages_contacts"
    ),
    results: bigIntColumn(row.results ?? 0, "results"),
    costPerResult: row.cost_per_result ?? 0,
    postReactions: bigIntColumn(row.post_reactions ?? 0, "post_reactions"),
    postComments: bigIntColumn(row.post_comments ?? 0, "post_comments"),
    rawPayload: jsonbColumn<Record<string, unknown>>(row.raw_payload),
  };
}

/** Positional placeholders $start..$start+count-1 for IN (...) lists. */
function idPlaceholders(start: number, count: number): string {
  return Array.from({ length: count }, (_, i) => `$${start + i}`).join(", ");
}

export class PgInsightSnapshotRepository implements InsightSnapshotRepository {
  constructor(private readonly db: PostgresDatabase) {}

  async append(snapshot: Omit<InsightSnapshot, "id">): Promise<InsightSnapshot> {
    const id = randomUUID();
    await this.db.execute(
      `INSERT INTO insight_snapshots
         (id, campaign_id, captured_at, reporting_from, reporting_to,
          impressions, clicks, link_clicks, spend, ctr, cpc, cpm, reach,
          frequency, clicks_all, unique_clicks, unique_ctr,
          landing_page_views, outbound_clicks, outbound_ctr,
          leads, messages_started, messages_contacts, results, cost_per_result,
          post_reactions, post_comments,
          raw_payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
               $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25,
               $26, $27, $28)`,
      [
        id,
        snapshot.campaignId,
        snapshot.capturedAt,
        formatReportingDate(snapshot.reportingFrom),
        formatReportingDate(snapshot.reportingTo),
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
        jsonbParam(snapshot.rawPayload),
      ]
    );
    return { id, ...snapshot };
  }

  async findLatestForCampaign(campaignId: string): Promise<InsightSnapshot | null> {
    const row = await this.db.queryOne<InsightSnapshotRow>(
      `SELECT * FROM insight_snapshots
       WHERE campaign_id = $1
       ORDER BY captured_at DESC
       LIMIT 1`,
      [campaignId]
    );
    return row ? toDomain(row) : null;
  }

  async findRangeForCampaign(
    campaignId: string,
    from: Date,
    to: Date,
    page: PageRequest
  ): Promise<PageResult<InsightSnapshot>> {
    const offset = page.cursor ? parseInt(page.cursor, 10) : 0;
    const rows = await this.db.query<InsightSnapshotRow>(
      `SELECT * FROM insight_snapshots
       WHERE campaign_id = $1 AND captured_at BETWEEN $2 AND $3
       ORDER BY captured_at
       LIMIT $4 OFFSET $5`,
      [campaignId, from, to, page.limit, offset]
    );
    const items = rows.map(toDomain);
    const nextCursor =
      items.length === page.limit ? String(offset + page.limit) : null;
    return { items, nextCursor };
  }

  async findLatestForCampaigns(
    campaignIds: readonly string[],
    from: Date,
    to: Date
  ): Promise<InsightSnapshot[]> {
    if (campaignIds.length === 0) return [];

    const ids = [...campaignIds];
    const k = ids.length;
    // Same latest-per-campaign shape as SQLite, with native timestamptz
    // MAX()/BETWEEN semantics instead of ISO-text comparison.
    const sql = `
      SELECT s.* FROM insight_snapshots s
      JOIN (
        SELECT campaign_id, MAX(captured_at) AS max_captured
        FROM insight_snapshots
        WHERE campaign_id IN (${idPlaceholders(1, k)})
          AND captured_at BETWEEN $${k + 1} AND $${k + 2}
        GROUP BY campaign_id
      ) m ON m.campaign_id = s.campaign_id AND s.captured_at = m.max_captured
      WHERE s.campaign_id IN (${idPlaceholders(k + 3, k)})
        AND s.captured_at BETWEEN $${2 * k + 3} AND $${2 * k + 4}
      ORDER BY s.campaign_id`;

    const rows = await this.db.query<InsightSnapshotRow>(sql, [
      ...ids,
      from,
      to,
      ...ids,
      from,
      to,
    ]);
    return rows.map(toDomain);
  }
}
