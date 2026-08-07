import type { DashboardPreference } from "../entities";

export interface DashboardPreferenceRepository {
  findForUser(userId: string): Promise<DashboardPreference | null>;
  findForClient(clientId: string): Promise<DashboardPreference | null>;
  save(
    pref: Omit<DashboardPreference, "id" | "updatedAt">
  ): Promise<DashboardPreference>;
}
