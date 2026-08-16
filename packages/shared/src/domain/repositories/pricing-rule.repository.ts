import type { PricingMetric, PricingRule } from "../pricing";

/**
 * Storage-agnostic interface for pricing rules. The SQLite
 * implementation lives in @repo/database; a future Supabase/Postgres
 * implementation uses the same interface, so the dashboard never knows
 * which storage engine backs it.
 */
export interface PricingRuleRepository {
  /**
   * All rules for a client, ordered by metric then effectiveFrom
   * ascending. Callers may use selectApplicablePricingRule() from
   * @repo/shared to pick the effective rule for a point in time.
   */
  findByClient(clientId: string): Promise<PricingRule[]>;
  /**
   * The newest rule for a client+metric whose effectiveFrom is <= at,
   * or null if none is effective yet.
   */
  findApplicable(
    clientId: string,
    metric: PricingMetric,
    at: Date
  ): Promise<PricingRule | null>;
  /**
   * Inserts a new effective-dated rule. Must contain at least one
   * pricing component. Creating a rule never touches historical data.
   */
  create(rule: Omit<PricingRule, "id" | "createdAt" | "updatedAt">): Promise<PricingRule>;
}