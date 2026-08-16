import type { Database } from "better-sqlite3";
import type { UserRole } from "@repo/shared";
import {
  SqliteClientRepository,
  SqlitePackageRepository,
} from "../repositories/index.js";
import { PackagePricingPropagation } from "./package-pricing-propagation.js";

export interface AssignPackageInput {
  /** Role of the acting user. Resolved by the web layer (getCurrentUser
   * + mock auth); the service only checks the policy. */
  actorRole: UserRole;
  clientId: string;
  /** The package to assign. Same as the current package = a no-op for
   * the timestamp (idempotent); different = reassignment. */
  packageId: string;
}

export interface AssignPackageResult {
  clientId: string;
  packageId: string;
  /** Assignment timestamp after the operation. Unchanged for a
   * same-package assign; refreshed for a reassignment. */
  packageAssignedAt: Date;
  /** True when the client's package actually changed (reassignment). */
  changed: boolean;
  /** PricingRule rows materialized by propagation. 0 when the package
   * has no defaults or they are already propagated. */
  pricingRulesCreated: number;
}

/**
 * Package Assignment Service — the application-level coordination behind
 * "assign this client to that package". Callers (the future Admin panel
 * server action) resolve the current user and pass their role in.
 *
 * Sequence (all checks before the first write, so nothing is written for
 * an invalid request):
 *
 *   1. Actor authorization — only super_admin for now.
 *   2. Target client must exist.
 *   3. Target package must exist.
 *   4. Reassignment: update the client's packageId; the repository owns
 *      the packageAssignedAt lifecycle (refreshed only when the package
 *      actually changes). Same-package leaves the timestamp untouched.
 *   5. PackagePricingPropagation.propagateForClient() materializes the
 *      package's pricingDefaults as client-scoped PricingRule rows using
 *      the (possibly new) packageAssignedAt as effectiveFrom.
 *
 * There is intentionally NO business orchestration in ClientRepository —
 * that stays a pure storage boundary. No pricing logic is duplicated and
 * the PricingRule / InsightSnapshot structures are never modified.
 *
 * TRANSACTION LIMITATION (reported, not worked around):
 * The repository layer is async (Promise-returning methods), and
 * better-sqlite3's db.transaction() rejects functions that return a
 * promise ("Transaction function cannot return a promise") — verified in
 * the installed better-sqlite3 11.10.0 source. A manual BEGIN/COMMIT
 * across awaits would hold the transaction open on the shared singleton
 * connection, which is unsafe when the dashboard server handles
 * concurrent requests. Wrapping this flow in a single SQLite transaction
 * would therefore require rewriting the repositories as synchronous or
 * introducing a transaction-scoped connection abstraction — a larger
 * refactor, out of scope here.
 *
 * Smallest safe approach (what this service does):
 *   - Every validation happens before any write; the first write is a
 *     single-statement client UPDATE (the repository re-validates the
 *     package inside it).
 *   - Propagation is INSERT-only and idempotent: on same-package assigns
 *     it creates nothing when rules already exist, and after a partial
 *     failure a re-run completes only the missing rules. The client row
 *     is therefore always internally consistent (correct packageId +
 *     packageAssignedAt), and the operation is re-runnable.
 */
export class PackageAssignmentService {
  constructor(
    private readonly db: Database,
    private readonly propagation: {
      propagateForClient(clientId: string): Promise<number>;
    } = new PackagePricingPropagation(db)
  ) {}

  async assignPackage(input: AssignPackageInput): Promise<AssignPackageResult> {
    const { actorRole, clientId, packageId } = input;

    if (actorRole !== "super_admin") {
      throw new Error("Only super admin can assign packages");
    }

    const clients = new SqliteClientRepository(this.db);
    const client = await clients.findById(clientId);
    if (!client) {
      throw new Error(`Client not found: ${clientId}`);
    }

    const pkg = await new SqlitePackageRepository(this.db).findById(packageId);
    if (!pkg) {
      throw new Error(`Package not found: ${packageId}`);
    }

    const changed = packageId !== client.packageId;
    let packageAssignedAt = client.packageAssignedAt;
    if (changed) {
      const updated = await clients.update(client.id, { packageId });
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