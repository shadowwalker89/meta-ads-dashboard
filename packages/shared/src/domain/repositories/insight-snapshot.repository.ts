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

  /**
   * The latest snapshot of EACH campaign whose captured_at falls within
   * [from, to]. Snapshots are cumulative period totals per campaign, so
   * aggregation must use the latest reading per campaign within the
   * range — never multiple snapshots of the same campaign summed.
   *
   * Campaigns with no snapshot in the range are omitted; the result is
   * ordered by campaignId. Summing is intentionally left to the caller
   * (the dashboard read service), keeping this a single storage query
   * and aggregation logic pure/testable in the app layer.
   */
  findLatestForCampaigns(
    campaignIds: readonly string[],
    from: Date,
    to: Date
  ): Promise<InsightSnapshot[]>;
}
