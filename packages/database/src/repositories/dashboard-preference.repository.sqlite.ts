import type { Database } from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type {
  DashboardPreference,
  DashboardPreferenceRepository,
  DashboardKpiKey,
} from "@repo/shared";
import { sanitizeDashboardKpiKeys } from "@repo/shared";

interface DashboardPreferenceRow {
  id: string;
  user_id: string | null;
  client_id: string | null;
  visible_metrics: string;
  theme: string;
  updated_at: string;
}

function parseVisibleMetrics(raw: string): DashboardKpiKey[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return sanitizeDashboardKpiKeys(parsed);
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
    updatedAt: new Date(row.updated_at),
  };
}

export class SqliteDashboardPreferenceRepository implements DashboardPreferenceRepository {
  constructor(private readonly db: Database) {}

  async findForUser(userId: string): Promise<DashboardPreference | null> {
    const row = this.db
      .prepare("SELECT * FROM dashboard_preferences WHERE user_id = ?")
      .get(userId) as DashboardPreferenceRow | undefined;
    return row ? toDomain(row) : null;
  }

  async findForClient(clientId: string): Promise<DashboardPreference | null> {
    const row = this.db
      .prepare("SELECT * FROM dashboard_preferences WHERE client_id = ?")
      .get(clientId) as DashboardPreferenceRow | undefined;
    return row ? toDomain(row) : null;
  }

  // Upsert done as find-then-write (not a SQL ON CONFLICT) because
  // user_id/client_id can both be NULL, and SQLite treats NULLs as
  // distinct in UNIQUE constraints — this keeps the behavior correct
  // and explicit either way.
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

    const updatedAt = new Date().toISOString();

    if (existing) {
      this.db
        .prepare(
          `UPDATE dashboard_preferences
           SET visible_metrics = ?, theme = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(JSON.stringify(cleanPref.visibleMetrics), cleanPref.theme, updatedAt, existing.id);
      return { ...existing, ...cleanPref, updatedAt: new Date(updatedAt) };
    }

    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO dashboard_preferences (id, user_id, client_id, visible_metrics, theme, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        cleanPref.userId,
        cleanPref.clientId,
        JSON.stringify(cleanPref.visibleMetrics),
        cleanPref.theme,
        updatedAt
      );
    return { id, ...cleanPref, updatedAt: new Date(updatedAt) };
  }
}
