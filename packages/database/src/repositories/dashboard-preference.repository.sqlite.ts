import type { Database } from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { DashboardPreference, DashboardPreferenceRepository } from "@repo/shared";

interface DashboardPreferenceRow {
  id: string;
  user_id: string | null;
  client_id: string | null;
  visible_metrics: string;
  theme: string;
  updated_at: string;
}

function toDomain(row: DashboardPreferenceRow): DashboardPreference {
  return {
    id: row.id,
    userId: row.user_id,
    clientId: row.client_id,
    visibleMetrics: JSON.parse(row.visible_metrics),
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
    const existing = pref.userId
      ? await this.findForUser(pref.userId)
      : pref.clientId
        ? await this.findForClient(pref.clientId)
        : null;

    const updatedAt = new Date().toISOString();

    if (existing) {
      this.db
        .prepare(
          `UPDATE dashboard_preferences
           SET visible_metrics = ?, theme = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(JSON.stringify(pref.visibleMetrics), pref.theme, updatedAt, existing.id);
      return { ...existing, ...pref, updatedAt: new Date(updatedAt) };
    }

    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO dashboard_preferences (id, user_id, client_id, visible_metrics, theme, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        pref.userId,
        pref.clientId,
        JSON.stringify(pref.visibleMetrics),
        pref.theme,
        updatedAt
      );
    return { id, ...pref, updatedAt: new Date(updatedAt) };
  }
}
