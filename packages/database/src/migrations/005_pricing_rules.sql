-- 005_pricing_rules.sql
-- Pricing Foundation.
--
-- One row per client+metric pricing rule. Effective-dated: changing
-- pricing inserts a NEW row with a later effective_from — historical
-- rules and raw Meta insight_snapshots are never mutated.
--
-- Only cost metrics are pricable (spend, cpc, cpm, costPerResult);
-- the CHECK prevents a non-cost metric from ever becoming pricable.

CREATE TABLE IF NOT EXISTS pricing_rules (
  id                     TEXT PRIMARY KEY,
  client_id              TEXT NOT NULL REFERENCES clients(id),
  metric                 TEXT NOT NULL CHECK (metric IN ('spend', 'cpc', 'cpm', 'costPerResult')),
  percentage_markup      REAL,
  fixed_markup           REAL,
  minimum_customer_value REAL,
  effective_from         TEXT NOT NULL,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL,
  CHECK (
    percentage_markup IS NOT NULL OR
    fixed_markup IS NOT NULL OR
    minimum_customer_value IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_pricing_rules_client
  ON pricing_rules(client_id, effective_from);