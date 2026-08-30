import { isAtResourceLimit } from "@repo/shared";
import type {
  AdAccountRepository,
  CampaignRepository,
  ClientRepository,
  PackageRepository,
} from "@repo/shared";

/**
 * Package resource-limit enforcement — provider-neutral version.
 *
 * Identical semantics to SqlitePackageEnforcement but accepts the four
 * repository interfaces instead of a raw better-sqlite3 Database handle.
 * This is what createRepositories() wires for the supabase branch, and
 * what the dashboard/collector use via getRepositories() once
 * DATABASE_PROVIDER is set.
 *
 * SqlitePackageEnforcement is preserved unchanged for backward
 * compatibility: its tests, exports, and call sites that pass a raw
 * Database handle continue to work without modification.
 */
export class PackageEnforcement {
  constructor(
    private readonly clients: ClientRepository,
    private readonly packages: PackageRepository,
    private readonly adAccounts: AdAccountRepository,
    private readonly campaigns: CampaignRepository
  ) {}

  async assertCanCreateAdAccount(clientId: string): Promise<void> {
    const client = await this.clients.findById(clientId);
    if (!client) {
      throw new Error(`Client not found: ${clientId}`);
    }
    const pkg = await this.packages.findById(client.packageId);
    const max = pkg?.maxAdAccounts ?? null;

    const current = await this.adAccounts.findByClient(clientId);
    if (isAtResourceLimit(current.length, max)) {
      throw new Error(
        `Client has reached the maximum number of ad accounts` +
          (max !== null ? ` (${max})` : "")
      );
    }
  }

  async assertCanCreateCampaign(clientId: string): Promise<void> {
    const client = await this.clients.findById(clientId);
    if (!client) {
      throw new Error(`Client not found: ${clientId}`);
    }
    const pkg = await this.packages.findById(client.packageId);
    const max = pkg?.maxCampaigns ?? null;

    const current = await this.countCampaignsForClient(clientId);
    if (isAtResourceLimit(current, max)) {
      throw new Error(
        `Client has reached the maximum number of campaigns` +
          (max !== null ? ` (${max})` : "")
      );
    }
  }

  private async countCampaignsForClient(clientId: string): Promise<number> {
    const accts = await this.adAccounts.findByClient(clientId);
    let total = 0;
    for (const acct of accts) {
      total += (await this.campaigns.findByAdAccount(acct.id)).length;
    }
    return total;
  }
}
