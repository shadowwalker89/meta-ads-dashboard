import type { CollectorJob } from "../entities";

export interface CollectorJobRepository {
  findById(id: string): Promise<CollectorJob | null>;
  findLatestForAdAccount(adAccountId: string): Promise<CollectorJob | null>;
  start(
    adAccountId: string,
    source: CollectorJob["source"]
  ): Promise<CollectorJob>;
  complete(
    id: string,
    status: "success" | "failed",
    errorMessage?: string
  ): Promise<CollectorJob>;
}
