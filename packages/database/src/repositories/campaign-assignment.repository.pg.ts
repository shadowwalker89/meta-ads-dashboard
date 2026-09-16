import { randomUUID } from "node:crypto";
import type { PostgresDatabase } from "../client-pg.js";
import type { CampaignAssignment, CampaignAssignmentRepository } from "@repo/shared";
import { timestampColumn } from "./pg-row-convert.js";

interface CampaignAssignmentRow {
  id: string;
  campaign_id: string;
  client_id: string;
  assigned_at: unknown;
  assigned_by: string;
  is_active: boolean;
}

function toDomain(row: CampaignAssignmentRow): CampaignAssignment {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    clientId: row.client_id,
    assignedAt: timestampColumn(row.assigned_at, "assigned_at"),
    assignedBy: row.assigned_by,
    isActive: row.is_active,
  };
}

export class PgCampaignAssignmentRepository implements CampaignAssignmentRepository {
  constructor(private readonly db: PostgresDatabase) {}

  async findActiveByCampaign(campaignId: string): Promise<CampaignAssignment | null> {
    const rows = await this.db.query<CampaignAssignmentRow>(
      `SELECT * FROM campaign_assignments
       WHERE campaign_id = $1 AND is_active = true
       LIMIT 1`,
      [campaignId]
    );
    return rows.length > 0 ? toDomain(rows[0]) : null;
  }

  async findActiveByClient(clientId: string): Promise<CampaignAssignment[]> {
    const rows = await this.db.query<CampaignAssignmentRow>(
      `SELECT * FROM campaign_assignments
       WHERE client_id = $1 AND is_active = true`,
      [clientId]
    );
    return rows.map(toDomain);
  }

  async create(assignment: Omit<CampaignAssignment, "id">): Promise<CampaignAssignment> {
    const id = randomUUID();
    // The partial unique index (campaign_id WHERE is_active = true)
    // violation surfaces as the driver's raw error (code 23505) —
    // deliberately NOT swallowed, matching the SQLite repository.
    await this.db.execute(
      `INSERT INTO campaign_assignments
         (id, campaign_id, client_id, assigned_at, assigned_by, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        id,
        assignment.campaignId,
        assignment.clientId,
        assignment.assignedAt,
        assignment.assignedBy,
        assignment.isActive,
      ]
    );
    return { id, ...assignment };
  }

  async deactivate(id: string): Promise<void> {
    await this.db.execute(
      `UPDATE campaign_assignments
       SET is_active = false
       WHERE id = $1`,
      [id]
    );
  }
}
