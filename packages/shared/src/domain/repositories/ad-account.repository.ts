import type { AdAccount } from "../entities";

export interface AdAccountRepository {
  findById(id: string): Promise<AdAccount | null>;
  findByClient(clientId: string): Promise<AdAccount[]>;
  create(adAccount: Omit<AdAccount, "id" | "createdAt">): Promise<AdAccount>;
  updateStatus(id: string, status: AdAccount["status"]): Promise<AdAccount>;
  updateSource(
    id: string,
    source: AdAccount["source"],
    metaAdAccountId: string | null
  ): Promise<AdAccount>;
}
