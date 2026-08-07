import type { InsightSnapshot } from "../entities";
import type { PageRequest, PageResult } from "./shared";

export interface InsightSnapshotRepository {
  append(snapshot: Omit<InsightSnapshot, "id">): Promise<InsightSnapshot>;
  findLatestForCampaign(campaignId: string): Promise<InsightSnapshot | null>;
  findRangeForCampaign(
    campaignId: string,
    from: Date,
    to: Date,
    page: PageRequest
  ): Promise<PageResult<InsightSnapshot>>;
}
