import { randomUUID } from "node:crypto";
import type { PostgresDatabase } from "../client-pg.js";
import {
  hasPricingComponents,
  isPricingMetric,
  type PricingMetric,
  type PricingRule,
  type PricingRuleRepository,
} from "@repo/shared";
import { timestampColumn } from "./pg-row-convert.js";

interface PricingRuleRow {
  id: string;
  client_id: string;
  metric: string;
  percentage_markup: number | null;
  fixed_markup: number | null;
  minimum_customer_value: number | null;
  effective_from: unknown;
  created_at: unknown;
  updated_at: unknown;
}

function toDomain(row: PricingRuleRow): PricingRule {
  return {
    id: row.id,
    clientId: row.client_id,
    metric: row.metric as PricingMetric,
    percentageMarkup: row.percentage_markup,
    fixedMarkup: row.fixed_markup,
    minimumCustomerValue: row.minimum_customer_value,
    effectiveFrom: timestampColumn(row.effective_from, "effective_from"),
    createdAt: timestampColumn(row.created_at, "created_at"),
    updatedAt: timestampColumn(row.updated_at, "updated_at"),
  };
}

export class PgPricingRuleRepository implements PricingRuleRepository {
  constructor(private readonly db: PostgresDatabase) {}

  async findByClient(clientId: string): Promise<PricingRule[]> {
    const rows = await this.db.query<PricingRuleRow>(
      `SELECT * FROM pricing_rules
       WHERE client_id = $1
       ORDER BY metric, effective_from`,
      [clientId]
    );
    return rows.map(toDomain);
  }

  async findApplicable(
    clientId: string,
    metric: PricingMetric,
    at: Date
  ): Promise<PricingRule | null> {
    const row = await this.db.queryOne<PricingRuleRow>(
      `SELECT * FROM pricing_rules
       WHERE client_id = $1 AND metric = $2 AND effective_from <= $3
       ORDER BY effective_from DESC
       LIMIT 1`,
      [clientId, metric, at]
    );
    return row ? toDomain(row) : null;
  }

  async create(
    rule: Omit<PricingRule, "id" | "createdAt" | "updatedAt">
  ): Promise<PricingRule> {
    // Same domain validation as the SQLite implementation — the storage
    // engine never weakens pricing semantics.
    if (!isPricingMetric(rule.metric)) {
      throw new Error(`Metric is not pricable: ${rule.metric}`);
    }
    if (!hasPricingComponents(rule)) {
      throw new Error("Pricing rule must have at least one pricing component");
    }

    const id = randomUUID();
    const now = new Date();
    await this.db.execute(
      `INSERT INTO pricing_rules
         (id, client_id, metric, percentage_markup, fixed_markup,
          minimum_customer_value, effective_from, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        rule.clientId,
        rule.metric,
        rule.percentageMarkup,
        rule.fixedMarkup,
        rule.minimumCustomerValue,
        rule.effectiveFrom,
        now,
        now,
      ]
    );
    return { id, ...rule, createdAt: now, updatedAt: now };
  }
}
