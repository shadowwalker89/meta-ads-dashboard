import type { Database } from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { CollectorJob, CollectorJobRepository } from "@repo/shared";

interface CollectorJobRow {
  id: string;
  ad_account_id: string;
  source: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  error_message: string | null;
}

function toDomain(row: CollectorJobRow): CollectorJob {
  return {
    id: row.id,
    adAccountId: row.ad_account_id,
    source: row.source as CollectorJob["source"],
    status: row.status as CollectorJob["status"],
    startedAt: new Date(row.started_at),
    finishedAt: row.finished_at ? new Date(row.finished_at) : null,
    errorMessage: row.error_message,
  };
}

export class SqliteCollectorJobRepository implements CollectorJobRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<CollectorJob | null> {
    const row = this.db.prepare("SELECT * FROM collector_jobs WHERE id = ?").get(id) as
      | CollectorJobRow
      | undefined;
    return row ? toDomain(row) : null;
  }

  async findLatestForAdAccount(adAccountId: string): Promise<CollectorJob | null> {
    const row = this.db
      .prepare(
        `SELECT * FROM collector_jobs
         WHERE ad_account_id = ?
         ORDER BY started_at DESC
         LIMIT 1`
      )
      .get(adAccountId) as CollectorJobRow | undefined;
    return row ? toDomain(row) : null;
  }

  async start(adAccountId: string, source: CollectorJob["source"]): Promise<CollectorJob> {
    const id = randomUUID();
    const startedAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO collector_jobs (id, ad_account_id, source, status, started_at)
         VALUES (?, ?, ?, 'running', ?)`
      )
      .run(id, adAccountId, source, startedAt);
    return {
      id,
      adAccountId,
      source,
      status: "running",
      startedAt: new Date(startedAt),
      finishedAt: null,
      errorMessage: null,
    };
  }

  async complete(
    id: string,
    status: "success" | "failed",
    errorMessage?: string
  ): Promise<CollectorJob> {
    const finishedAt = new Date().toISOString();
    this.db
      .prepare(
        "UPDATE collector_jobs SET status = ?, finished_at = ?, error_message = ? WHERE id = ?"
      )
      .run(status, finishedAt, errorMessage ?? null, id);
    const updated = await this.findById(id);
    if (!updated) throw new Error(`CollectorJob not found: ${id}`);
    return updated;
  }
}
