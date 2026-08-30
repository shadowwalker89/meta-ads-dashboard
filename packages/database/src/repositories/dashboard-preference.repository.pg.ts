import { randomUUID } from "node:crypto";
import type { PostgresDatabase } from "../client-pg.js";
import {
  sanitizeDashboardKpiKeys,
  type DashboardKpiKey,
  type DashboardPreference,
  type DashboardPreferenceRepository,
} from "@repo/shared";
import { jsonbColumn, timestampColumn } from "./pg-row-convert.js";

interface DashboardPreferenceRow {
  id: string;
  user_id: string | null;
  client_id: string | null;
  visible_metrics: unknown;
  theme: string;
  updated_at: unknown;
}

function parseVisibleMetrics(raw: unknown): DashboardKpiKey[] {
  // JSONB arrives parsed; the string branch only guards exotic parser
  // configurations (same defensive posture as the SQLite implementation).
  const parsed: unknown =
    typeof raw === "string" ? safeParse(raw) : jsonbColumn<unknown>(raw);
  if (!Array.isArray(parsed)) return [];
  return sanitizeDashboardKpiKeys(parsed);
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Corrupt JSON in storage — treat as empty so the dashboard falls
    // back to the default set instead of crashing.
    return [];
  }
}

function toDomain(row: DashboardPreferenceRow): DashboardPreference {
  return {
    id: row.id,
    userId: row.user_id,
    clientId: row.client_id,
    visibleMetrics: parseVisibleMetrics(row.visible_metrics),
    theme: row.theme as DashboardPreference["theme"],
    updatedAt: timestampColumn(row.updated_at, "updated_at"),
  };
}

export class PgDashboardPreferenceRepository
  implements DashboardPreferenceRepository
{
  constructor(private readonly db: PostgresDatabase) {}

  async findForUser(userId: string): Promise<DashboardPreference | null> {
    const row = await this.db.queryOne<DashboardPreferenceRow>(
      "SELECT * FROM dashboard_preferences WHERE user_id = $1",
      [userId]
    );
    return row ? toDomain(row) : null;
  }

  async findForClient(clientId: string): Promise<DashboardPreference | null> {
    const row = await this.db.queryOne<DashboardPreferenceRow>(
      "SELECT * FROM dashboard_preferences WHERE client_id = $1",
      [clientId]
    );
    return row ? toDomain(row) : null;
  }

  // Find-then-write upsert, deliberately identical to the SQLite
  // implementation: user_id/client_id can both be NULL and NULLs are
  // distinct in UNIQUE constraints in PostgreSQL too — an ON CONFLICT
  // rewrite would change semantics, not simplify them. Plain objects/
  // arrays go into the JSONB column without manual stringify.
  async save(
    pref: Omit<DashboardPreference, "id" | "updatedAt">
  ): Promise<DashboardPreference> {
    const sanitized = sanitizeDashboardKpiKeys(pref.visibleMetrics);
    const cleanPref = { ...pref, visibleMetrics: sanitized };

    const existing = cleanPref.userId
      ? await this.findForUser(cleanPref.userId)
      : cleanPref.clientId
        ? await this.findForClient(cleanPref.clientId)
        : null;

    const updatedAt = new Date();

    if (existing) {
      await this.db.execute(
        `UPDATE dashboard_preferences
         SET visible_metrics = $1, theme = $2, updated_at = $3
         WHERE id = $4`,
        [cleanPref.visibleMetrics, cleanPref.theme, updatedAt, existing.id]
      );
      return { ...existing, ...cleanPref, updatedAt };
    }

    const id = randomUUID();
    await this.db.execute(
      `INSERT INTO dashboard_preferences (id, user_id, client_id, visible_metrics, theme, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        id,
        cleanPref.userId,
        cleanPref.clientId,
        cleanPref.visibleMetrics,
        cleanPref.theme,
        updatedAt,
      ]
    );
    return { id, ...cleanPref, updatedAt };
  }
}
