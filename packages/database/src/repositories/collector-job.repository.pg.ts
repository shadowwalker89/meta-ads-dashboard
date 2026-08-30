import { randomUUID } from "node:crypto";
import type { PostgresDatabase } from "../client-pg.js";
import type { CollectorJob, CollectorJobRepository } from "@repo/shared";
import { timestampColumn } from "./pg-row-convert.js";

interface CollectorJobRow {
  id: string;
  ad_account_id: string;
  source: string;
  status: string;
  started_at: unknown;
  finished_at: unknown;
  error_message: string | null;
}

function toDomain(row: CollectorJobRow): CollectorJob {
  return {
    id: row.id,
    adAccountId: row.ad_account_id,
    source: row.source as CollectorJob["source"],
    status: row.status as CollectorJob["status"],
    startedAt: timestampColumn(row.started_at, "started_at"),
    finishedAt: row.finished_at
      ? timestampColumn(row.finished_at, "finished_at")
      : null,
    errorMessage: row.error_message,
  };
}

export class PgCollectorJobRepository implements CollectorJobRepository {
  constructor(private readonly db: PostgresDatabase) {}

  async findById(id: string): Promise<CollectorJob | null> {
    const row = await this.db.queryOne<CollectorJobRow>(
      "SELECT * FROM collector_jobs WHERE id = $1",
      [id]
    );
    return row ? toDomain(row) : null;
  }

  async findLatestForAdAccount(adAccountId: string): Promise<CollectorJob | null> {
    const row = await this.db.queryOne<CollectorJobRow>(
      `SELECT * FROM collector_jobs
       WHERE ad_account_id = $1
       ORDER BY started_at DESC
       LIMIT 1`,
      [adAccountId]
    );
    return row ? toDomain(row) : null;
  }

  async start(
    adAccountId: string,
    source: CollectorJob["source"]
  ): Promise<CollectorJob> {
    const id = randomUUID();
    const startedAt = new Date();
    await this.db.execute(
      `INSERT INTO collector_jobs (id, ad_account_id, source, status, started_at)
       VALUES ($1, $2, $3, 'running', $4)`,
      [id, adAccountId, source, startedAt]
    );
    return {
      id,
      adAccountId,
      source,
      status: "running",
      startedAt,
      finishedAt: null,
      errorMessage: null,
    };
  }

  async complete(
    id: string,
    status: "success" | "failed",
    errorMessage?: string
  ): Promise<CollectorJob> {
    const finishedAt = new Date();
    await this.db.execute(
      "UPDATE collector_jobs SET status = $1, finished_at = $2, error_message = $3 WHERE id = $4",
      [status, finishedAt, errorMessage ?? null, id]
    );
    const updated = await this.findById(id);
    if (!updated) throw new Error(`CollectorJob not found: ${id}`);
    return updated;
  }
}
