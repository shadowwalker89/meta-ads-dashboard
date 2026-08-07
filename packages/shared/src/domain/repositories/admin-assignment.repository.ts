import type { AdminAssignment } from "../entities";

export interface AdminAssignmentRepository {
  findByAdmin(adminUserId: string): Promise<AdminAssignment[]>;
  findByClient(clientId: string): Promise<AdminAssignment[]>;
  assign(adminUserId: string, clientId: string): Promise<AdminAssignment>;
  unassign(adminUserId: string, clientId: string): Promise<void>;
}
