import type { Database } from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type {
  PricingMetric,
  PricingRule,
  PricingRuleRepository,
} from "@repo/shared";
import { hasPricingComponents, isPricingMetric } from "@repo/shared";

interface PricingRuleRow {
  id: string;
  client_id: string;
  metric: string;
  percentage_markup: number | null;
  fixed_markup: number | null;
  minimum_customer_value: number | null;
  effective_from: string;
  created_at: string;
  updated_at: string;
}

function toDomain(row: PricingRuleRow): PricingRule {
  return {
    id: row.id,
    clientId: row.client_id,
    metric: row.metric as PricingMetric,
    percentageMarkup: row.percentage_markup,
    fixedMarkup: row.fixed_markup,
    minimumCustomerValue: row.minimum_customer_value,
    effectiveFrom: new Date(row.effective_from),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export class SqlitePricingRuleRepository implements PricingRuleRepository {
  constructor(private readonly db: Database) {}

  async findByClient(clientId: string): Promise<PricingRule[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM pricing_rules
         WHERE client_id = ?
         ORDER BY metric, effective_from`
      )
      .all(clientId) as PricingRuleRow[];
    return rows.map(toDomain);
  }

  async findApplicable(
    clientId: string,
    metric: PricingMetric,
    at: Date
  ): Promise<PricingRule | null> {
    const row = this.db
      .prepare(
        `SELECT * FROM pricing_rules
         WHERE client_id = ? AND metric = ? AND effective_from <= ?
         ORDER BY effective_from DESC
         LIMIT 1`
      )
      .get(clientId, metric, at.toISOString()) as PricingRuleRow | undefined;
    return row ? toDomain(row) : null;
  }

  async create(
    rule: Omit<PricingRule, "id" | "createdAt" | "updatedAt">
  ): Promise<PricingRule> {
    if (!isPricingMetric(rule.metric)) {
      throw new Error(`Metric is not pricable: ${rule.metric}`);
    }
    if (!hasPricingComponents(rule)) {
      throw new Error("Pricing rule must have at least one pricing component");
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO pricing_rules
           (id, client_id, metric, percentage_markup, fixed_markup,
            minimum_customer_value, effective_from, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        rule.clientId,
        rule.metric,
        rule.percentageMarkup,
        rule.fixedMarkup,
        rule.minimumCustomerValue,
        rule.effectiveFrom.toISOString(),
        now,
        now
      );
    return { id, ...rule, createdAt: new Date(now), updatedAt: new Date(now) };
  }
}