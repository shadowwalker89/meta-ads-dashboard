import type { CampaignAssignment } from "../entities";

export interface CampaignAssignmentRepository {
  findActiveByCampaign(campaignId: string): Promise<CampaignAssignment | null>;
  findActiveByClient(clientId: string): Promise<CampaignAssignment[]>;
  create(assignment: Omit<CampaignAssignment, "id">): Promise<CampaignAssignment>;
  deactivate(id: string): Promise<void>;
}