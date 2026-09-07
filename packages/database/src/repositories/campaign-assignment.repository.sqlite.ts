import type { Database } from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { CampaignAssignment, CampaignAssignmentRepository } from "@repo/shared";

interface CampaignAssignmentRow {
  id: string;
  campaign_id: string;
  client_id: string;
  assigned_at: string;
  assigned_by: string;
  is_active: number;
}

function toDomain(row: CampaignAssignmentRow): CampaignAssignment {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    clientId: row.client_id,
    assignedAt: new Date(row.assigned_at),
    assignedBy: row.assigned_by,
    isActive: row.is_active === 1,
  };
}

export class SqliteCampaignAssignmentRepository implements CampaignAssignmentRepository {
  constructor(private readonly db: Database) {}

  async findActiveByCampaign(campaignId: string): Promise<CampaignAssignment | null> {
    const row = this.db
      .prepare(
        `SELECT * FROM campaign_assignments
         WHERE campaign_id = ? AND is_active = 1
         LIMIT 1`
      )
      .get(campaignId) as CampaignAssignmentRow | undefined;
    return row ? toDomain(row) : null;
  }

  async findActiveByClient(clientId: string): Promise<CampaignAssignment[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM campaign_assignments
         WHERE client_id = ? AND is_active = 1`
      )
      .all(clientId) as CampaignAssignmentRow[];
    return rows.map(toDomain);
  }

  async create(assignment: Omit<CampaignAssignment, "id">): Promise<CampaignAssignment> {
    const id = randomUUID();
    const assignedAt = assignment.assignedAt.toISOString();
    this.db
      .prepare(
        `INSERT INTO campaign_assignments
           (id, campaign_id, client_id, assigned_at, assigned_by, is_active)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        assignment.campaignId,
        assignment.clientId,
        assignedAt,
        assignment.assignedBy,
        assignment.isActive ? 1 : 0
      );
    return { id, ...assignment };
  }

  async deactivate(id: string): Promise<void> {
    this.db
      .prepare(
        `UPDATE campaign_assignments
         SET is_active = 0
         WHERE id = ?`
      )
      .run(id);
  }
}