import type { PostgresDatabase } from "../client-pg.js";
import type { CampaignAssignment, CampaignAssignmentRepository } from "@repo/shared";

export class PgCampaignAssignmentRepository implements CampaignAssignmentRepository {
  constructor(private readonly db: PostgresDatabase) {}

  async findActiveByCampaign(campaignId: string): Promise<CampaignAssignment | null> {
    throw new Error("PgCampaignAssignmentRepository not implemented");
  }

  async findActiveByClient(clientId: string): Promise<CampaignAssignment[]> {
    throw new Error("PgCampaignAssignmentRepository not implemented");
  }

  async create(assignment: Omit<CampaignAssignment, "id">): Promise<CampaignAssignment> {
    throw new Error("PgCampaignAssignmentRepository not implemented");
  }

  async deactivate(id: string): Promise<void> {
    throw new Error("PgCampaignAssignmentRepository not implemented");
  }
}