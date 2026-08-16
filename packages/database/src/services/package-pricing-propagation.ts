import type { Database } from "better-sqlite3";
import type { PricingMetric, PricingRule } from "@repo/shared";
import { sanitizePackagePricingDefaults } from "@repo/shared";
import {
  SqliteClientRepository,
  SqlitePackageRepository,
  SqlitePricingRuleRepository,
} from "../repositories/index.js";

/**
 * Package Pricing Default Propagation.
 *
 * When a client is assigned (or reassigned) to a package, the package's
 * `pricingDefaults` are materialized into the client-scoped PricingRule
 * foundation as append-only rules, with `effectiveFrom` set to the
 * client's `packageAssignedAt` — the exact time the assignment took
 * effect. This is the bridge between the package's pricing defaults and
 * the existing client-scoped pricing model, and it never replaces it:
 *
 *   - Rules are INSERT-only. Existing PricingRules are never modified,
 *     and historical rules keep governing their own time ranges.
 *   - Newer client-specific rules remain authoritative: a rule already
 *     governing the metric at-or-after the assignment time wins, so
 *     propagation never duplicates it or shadows a client override.
 *   - Idempotent: re-running propagation for the same assignment creates
 *     nothing (a rule at the same effectiveFrom already exists).
 *   - Empty / sanitized-away defaults are a safe no-op.
 *   - InsightSnapshots and raw Meta values are never touched.
 *
 * Invoke this after the assignment/reassignment write (the future Admin
 * panel's "assign package" action). It is a plain callable service with
 * no scheduler or background work.
 */
export class PackagePricingPropagation {
  constructor(private readonly db: Database) {}

  /**
   * Materializes the client's package pricing defaults as client-scoped
   * PricingRule rows. Returns the number of rules created (0 when the
   * package is missing, defaults are empty, or everything already
   * propagated).
   */
  async propagateForClient(clientId: string): Promise<number> {
    const client = await new SqliteClientRepository(this.db).findById(clientId);
    if (!client) {
      throw new Error(`Client not found: ${clientId}`);
    }

    // A dangling/missing package has no defaults to materialize — the
    // client keeps its existing pricing untouched.
    const pkg = await new SqlitePackageRepository(this.db).findById(client.packageId);
    if (!pkg) {
      return 0;
    }

    // Sanitization is idempotent and defensive: the repository already
    // sanitizes on read, this guards against any non-sanitized source.
    const defaults = sanitizePackagePricingDefaults(pkg.pricingDefaults);
    if (Object.keys(defaults).length === 0) {
      return 0;
    }

    const pricing = new SqlitePricingRuleRepository(this.db);
    const rules = await pricing.findByClient(clientId);
    const effectiveFrom = client.packageAssignedAt;

    let created = 0;
    for (const [metric, components] of Object.entries(defaults)) {
      const typedMetric = metric as PricingMetric;
      const newest = newestRuleForMetric(rules, typedMetric);

      // A client rule already governs this metric at-or-after the
      // assignment time — either a previous propagation (same
      // effectiveFrom) or a newer client-specific override. Skipping
      // keeps propagation idempotent and preserves override authority.
      if (newest && newest.effectiveFrom.getTime() >= effectiveFrom.getTime()) {
        continue;
      }

      await pricing.create({
        clientId,
        metric: typedMetric,
        percentageMarkup: components.percentageMarkup,
        fixedMarkup: components.fixedMarkup,
        minimumCustomerValue: components.minimumCustomerValue,
        effectiveFrom,
      });
      created += 1;
    }

    return created;
  }
}

/** The rule with the newest effectiveFrom for a metric, mirroring the
 * newest-wins semantics of selectApplicablePricingRule. */
function newestRuleForMetric(
  rules: readonly PricingRule[],
  metric: PricingMetric
): PricingRule | null {
  let newest: PricingRule | null = null;
  for (const rule of rules) {
    if (rule.metric !== metric) continue;
    if (
      newest === null ||
      rule.effectiveFrom.getTime() > newest.effectiveFrom.getTime()
    ) {
      newest = rule;
    }
  }
  return newest;
}