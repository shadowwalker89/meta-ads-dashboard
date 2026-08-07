import type { Database } from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type {
  AuditLog,
  AuditLogRepository,
  PageRequest,
  PageResult,
} from "@repo/shared";

interface AuditLogRow {
  id: string;
  actor_user_id: string;
  action: string;
  target_entity_type: string;
  target_entity_id: string;
  metadata: string | null;
  created_at: string;
}

function toDomain(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    action: row.action,
    targetEntityType: row.target_entity_type,
    targetEntityId: row.target_entity_id,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    createdAt: new Date(row.created_at),
  };
}

export class SqliteAuditLogRepository implements AuditLogRepository {
  constructor(private readonly db: Database) {}

  async append(entry: Omit<AuditLog, "id" | "createdAt">): Promise<AuditLog> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO audit_logs
           (id, actor_user_id, action, target_entity_type, target_entity_id, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        entry.actorUserId,
        entry.action,
        entry.targetEntityType,
        entry.targetEntityId,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        createdAt
      );
    return { id, ...entry, createdAt: new Date(createdAt) };
  }

  async findByTarget(
    targetEntityType: string,
    targetEntityId: string,
    page: PageRequest
  ): Promise<PageResult<AuditLog>> {
    const offset = page.cursor ? parseInt(page.cursor, 10) : 0;
    const rows = this.db
      .prepare(
        `SELECT * FROM audit_logs
         WHERE target_entity_type = ? AND target_entity_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(targetEntityType, targetEntityId, page.limit, offset) as AuditLogRow[];
    const items = rows.map(toDomain);
    const nextCursor = items.length === page.limit ? String(offset + page.limit) : null;
    return { items, nextCursor };
  }

  async findByActor(actorUserId: string, page: PageRequest): Promise<PageResult<AuditLog>> {
    const offset = page.cursor ? parseInt(page.cursor, 10) : 0;
    const rows = this.db
      .prepare(
        `SELECT * FROM audit_logs
         WHERE actor_user_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(actorUserId, page.limit, offset) as AuditLogRow[];
    const items = rows.map(toDomain);
    const nextCursor = items.length === page.limit ? String(offset + page.limit) : null;
    return { items, nextCursor };
  }
}
