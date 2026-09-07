// This file exists to satisfy the import in provider.ts; the PgAdAccountRepository
// is not yet implemented.
import type { PostgresDatabase } from "../client-pg.js";
import type { AdAccount, AdAccountRepository } from "@repo/shared";

export class PgAdAccountRepository implements AdAccountRepository {
  constructor(private readonly db: PostgresDatabase) {}

  async findById(id: string): Promise<AdAccount | null> {
    throw new Error("PgAdAccountRepository not implemented");
  }

  async findByIds(ids: string[]): Promise<AdAccount[]> {
    throw new Error("PgAdAccountRepository not implemented");
  }

  async findByClient(clientId: string): Promise<AdAccount[]> {
    throw new Error("PgAdAccountRepository not implemented");
  }

  async create(adAccount: Omit<AdAccount, "id" | "createdAt">): Promise<AdAccount> {
    throw new Error("PgAdAccountRepository not implemented");
  }

  async updateStatus(id: string, status: AdAccount["status"]): Promise<AdAccount> {
    throw new Error("PgAdAccountRepository not implemented");
  }

  async updateSource(
    id: string,
    source: AdAccount["source"],
    metaAdAccountId: string | null
  ): Promise<AdAccount> {
    throw new Error("PgAdAccountRepository not implemented");
  }
}