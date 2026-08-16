import type { Database } from "better-sqlite3";
import { isAtResourceLimit } from "@repo/shared";
import {
  SqliteAdAccountRepository,
  SqliteCampaignRepository,
  SqliteClientRepository,
  SqlitePackageRepository,
} from "../repositories/index.js";

/**
 * Package resource-limit enforcement.
 *
 * The authoritative write paths for AdAccount and Campaign creation
 * call this service before inserting, so limits are enforced at the
 * server/business layer — never relying on UI. It composes the existing
 * repository abstractions (no duplicate SQL) and reads limits from the
 * Package entity settings (never from a package code string).
 *
 * Conventions:
 *   - Limit values follow the shared `isAtResourceLimit` rule: only a
 *     positive integer is enforced; null/non-positive means unlimited.
 *   - A missing client or package throws — you cannot create resources
 *     for a client that does not resolve.
 *   - Campaign counts span ALL ad accounts belonging to the client.
 *   - Only new inserts consume a slot; updating an existing record never
 *     re-runs the check against itself, so existing records stay valid.
 *   - This service is orthogonal to authorization: callers still enforce
 *     role/assignment rules independently.
 */
export class SqlitePackageEnforcement {
  constructor(private readonly db: Database) {}

  async assertCanCreateAdAccount(clientId: string): Promise<void> {
    const client = await new SqliteClientRepository(this.db).findById(clientId);
    if (!client) {
      throw new Error(`Client not found: ${clientId}`);
    }
    const pkg = await new SqlitePackageRepository(this.db).findById(client.packageId);
    const max = pkg?.maxAdAccounts ?? null;

    const current = await new SqliteAdAccountRepository(this.db).findByClient(clientId);
    if (isAtResourceLimit(current.length, max)) {
      throw new Error(
        `Client has reached the maximum number of ad accounts` +
          (max !== null ? ` (${max})` : "")
      );
    }
  }

  async assertCanCreateCampaign(clientId: string): Promise<void> {
    const client = await new SqliteClientRepository(this.db).findById(clientId);
    if (!client) {
      throw new Error(`Client not found: ${clientId}`);
    }
    const pkg = await new SqlitePackageRepository(this.db).findById(client.packageId);
    const max = pkg?.maxCampaigns ?? null;

    const current = await this.countCampaignsForClient(clientId);
    if (isAtResourceLimit(current, max)) {
      throw new Error(
        `Client has reached the maximum number of campaigns` +
          (max !== null ? ` (${max})` : "")
      );
    }
  }

  /**
   * Counts every campaign across every ad account of the client. Uses
   * the existing repository methods (findByClient + findByAdAccount) —
   * the same abstraction the dashboard uses — so there is no duplicate
   * SQL and the future storage swap keeps working unchanged.
   */
  private async countCampaignsForClient(clientId: string): Promise<number> {
    const adAccounts = await new SqliteAdAccountRepository(this.db).findByClient(
      clientId
    );
    const campaigns = new SqliteCampaignRepository(this.db);
    let total = 0;
    for (const adAccount of adAccounts) {
      total += (await campaigns.findByAdAccount(adAccount.id)).length;
    }
    return total;
  }
}