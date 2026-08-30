import type { PricingMetric, PricingRule } from "@repo/shared";
import { sanitizePackagePricingDefaults } from "@repo/shared";
import type {
  ClientRepository,
  PackageRepository,
  PricingRuleRepository,
} from "@repo/shared";

/**
 * Package Pricing Default Propagation — provider-neutral version.
 *
 * Identical semantics to PackagePricingPropagation but accepts the three
 * repository interfaces instead of a raw better-sqlite3 Database handle.
 * Used by RepositoryPackageAssignmentService and by createRepositories()
 * for the supabase branch.
 *
 * PackagePricingPropagation (SQLite-specific) is preserved unchanged.
 */
export class RepositoryPackagePricingPropagation {
  constructor(
    private readonly clients: ClientRepository,
    private readonly packages: PackageRepository,
    private readonly pricing: PricingRuleRepository
  ) {}

  async propagateForClient(clientId: string): Promise<number> {
    const client = await this.clients.findById(clientId);
    if (!client) {
      throw new Error(`Client not found: ${clientId}`);
    }

    const pkg = await this.packages.findById(client.packageId);
    if (!pkg) {
      return 0;
    }

    const defaults = sanitizePackagePricingDefaults(pkg.pricingDefaults);
    if (Object.keys(defaults).length === 0) {
      return 0;
    }

    const rules = await this.pricing.findByClient(clientId);
    const effectiveFrom = client.packageAssignedAt;

    let created = 0;
    for (const [metric, components] of Object.entries(defaults)) {
      const typedMetric = metric as PricingMetric;
      const newest = newestRuleForMetric(rules, typedMetric);

      if (newest && newest.effectiveFrom.getTime() >= effectiveFrom.getTime()) {
        continue;
      }

      await this.pricing.create({
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
