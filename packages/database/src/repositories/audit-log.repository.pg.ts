import { randomUUID } from "node:crypto";
import type { PostgresDatabase } from "../client-pg.js";
import type {
  AuditLog,
  AuditLogRepository,
  PageRequest,
  PageResult,
} from "@repo/shared";
import { jsonbColumn, jsonbParam, timestampColumn } from "./pg-row-convert.js";

interface AuditLogRow {
  id: string;
  actor_user_id: string;
  action: string;
  target_entity_type: string;
  target_entity_id: string;
  metadata: unknown;
  created_at: unknown;
}

function toDomain(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    action: row.action,
    targetEntityType: row.target_entity_type,
    targetEntityId: row.target_entity_id,
    metadata: jsonbColumn<Record<string, unknown>>(row.metadata),
    createdAt: timestampColumn(row.created_at, "created_at"),
  };
}

export class PgAuditLogRepository implements AuditLogRepository {
  constructor(private readonly db: PostgresDatabase) {}

  async append(entry: Omit<AuditLog, "id" | "createdAt">): Promise<AuditLog> {
    const id = randomUUID();
    const createdAt = new Date();
    await this.db.execute(
      `INSERT INTO audit_logs
         (id, actor_user_id, action, target_entity_type, target_entity_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        entry.actorUserId,
        entry.action,
        entry.targetEntityType,
        entry.targetEntityId,
        jsonbParam(entry.metadata),
        createdAt,
      ]
    );
    return { id, ...entry, createdAt };
  }

  async findByTarget(
    targetEntityType: string,
    targetEntityId: string,
    page: PageRequest
  ): Promise<PageResult<AuditLog>> {
    const offset = page.cursor ? parseInt(page.cursor, 10) : 0;
    const rows = await this.db.query<AuditLogRow>(
      `SELECT * FROM audit_logs
       WHERE target_entity_type = $1 AND target_entity_id = $2
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [targetEntityType, targetEntityId, page.limit, offset]
    );
    const items = rows.map(toDomain);
    const nextCursor =
      items.length === page.limit ? String(offset + page.limit) : null;
    return { items, nextCursor };
  }

  async findByActor(
    actorUserId: string,
    page: PageRequest
  ): Promise<PageResult<AuditLog>> {
    const offset = page.cursor ? parseInt(page.cursor, 10) : 0;
    const rows = await this.db.query<AuditLogRow>(
      `SELECT * FROM audit_logs
       WHERE actor_user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [actorUserId, page.limit, offset]
    );
    const items = rows.map(toDomain);
    const nextCursor =
      items.length === page.limit ? String(offset + page.limit) : null;
    return { items, nextCursor };
  }
}
