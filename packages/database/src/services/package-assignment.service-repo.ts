import type { UserRole, ClientRepository, PackageRepository, PricingRuleRepository } from "@repo/shared";
import { RepositoryPackagePricingPropagation } from "./package-pricing-propagation-repo.js";

export interface AssignPackageInput {
  actorRole: UserRole;
  clientId: string;
  packageId: string;
}

export interface AssignPackageResult {
  clientId: string;
  packageId: string;
  packageAssignedAt: Date;
  changed: boolean;
  pricingRulesCreated: number;
}

/**
 * Package Assignment Service — provider-neutral version.
 *
 * Identical semantics to PackageAssignmentService but accepts the three
 * repository interfaces instead of a raw better-sqlite3 Database handle.
 * Used by the dashboard package-admin.ts via getRepositories() and by
 * createRepositories() for the supabase branch.
 *
 * PackageAssignmentService (SQLite-specific) is preserved unchanged.
 */
export class RepositoryPackageAssignmentService {
  constructor(
    private readonly clients: ClientRepository,
    private readonly packages: PackageRepository,
    private readonly propagation: {
      propagateForClient(clientId: string): Promise<number>;
    }
  ) {}

  async assignPackage(input: AssignPackageInput): Promise<AssignPackageResult> {
    const { actorRole, clientId, packageId } = input;

    if (actorRole !== "super_admin") {
      throw new Error("Only super admin can assign packages");
    }

    const client = await this.clients.findById(clientId);
    if (!client) {
      throw new Error(`Client not found: ${clientId}`);
    }

    const pkg = await this.packages.findById(packageId);
    if (!pkg) {
      throw new Error(`Package not found: ${packageId}`);
    }

    const changed = packageId !== client.packageId;
    let packageAssignedAt = client.packageAssignedAt;
    if (changed) {
      const updated = await this.clients.update(client.id, { packageId });
      packageAssignedAt = updated.packageAssignedAt;
    }

    const pricingRulesCreated = await this.propagation.propagateForClient(clientId);

    return {
      clientId,
      packageId,
      packageAssignedAt,
      changed,
      pricingRulesCreated,
    };
  }
}

/** Convenience factory that wires the default propagation service. */
export function createRepositoryPackageAssignmentService(
  clients: ClientRepository,
  packages: PackageRepository,
  pricing: PricingRuleRepository
): RepositoryPackageAssignmentService {
  return new RepositoryPackageAssignmentService(
    clients,
    packages,
    new RepositoryPackagePricingPropagation(clients, packages, pricing)
  );
}
