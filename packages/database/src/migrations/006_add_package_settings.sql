-- 006_add_package_settings.sql
-- Package Foundation: typed tier configuration on the packages table.
--
-- Existing rows are preserved and backfilled conservatively:
--   - code            derived from the package name (lower-cased);
--   - settings        given safe defaults (1 collection/day, no limits,
--                     no retention, empty KPI/feature/pricing config).
-- The seed script then writes the real Bronze/Silver/Gold values
-- idempotently. No tier-specific logic lives in TypeScript.

ALTER TABLE packages ADD COLUMN code TEXT;
ALTER TABLE packages ADD COLUMN collection_frequency INTEGER NOT NULL DEFAULT 1;
ALTER TABLE packages ADD COLUMN max_ad_accounts INTEGER;
ALTER TABLE packages ADD COLUMN max_campaigns INTEGER;
ALTER TABLE packages ADD COLUMN retention_days INTEGER;
ALTER TABLE packages ADD COLUMN default_visible_kpis TEXT NOT NULL DEFAULT '[]';
ALTER TABLE packages ADD COLUMN features TEXT NOT NULL DEFAULT '{}';
ALTER TABLE packages ADD COLUMN pricing_defaults TEXT NOT NULL DEFAULT '{}';

-- Backfill a stable, unique code for every existing row. Legacy rows
-- can share a name (the old dev DB has duplicate Bronze/Silver/Gold
-- rows), so duplicates get a numeric suffix (bronze, bronze-2, ...).
-- The unique index below then succeeds without touching any data.
UPDATE packages
SET code = (
  SELECT numbered.code
  FROM (
    SELECT
      id,
      lower(name) || CASE WHEN rn = 1 THEN '' ELSE '-' || (rn - 1) END AS code
    FROM (
      SELECT
        id,
        name,
        ROW_NUMBER() OVER (
          PARTITION BY lower(name) ORDER BY created_at, id
        ) AS rn
      FROM packages
    )
  ) numbered
  WHERE numbered.id = packages.id
)
WHERE code IS NULL OR trim(code) = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_packages_code ON packages(code);