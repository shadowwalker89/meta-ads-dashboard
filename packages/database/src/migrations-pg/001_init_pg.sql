-- 001_init_pg.sql
-- PostgreSQL BASELINE schema — the FINAL current application schema
-- (the end state of SQLite migrations 001-008), written fresh for an
-- EMPTY PostgreSQL/Supabase database instead of replaying the SQLite
-- history. Historical steps that only existed to evolve the old dev
-- database (006 code backfill/dedup, 007 assigned_at backfill) have no
-- rows to fix here and are therefore intentionally absent.
--
-- Type mapping (approved architecture decision):
--   ids            TEXT(randomUUID app-generated) -> UUID   (app generates, no DB defaults)
--   timestamps     TEXT ISO-8601                  -> TIMESTAMPTZ
--   booleans       INTEGER 0/1                    -> BOOLEAN
--   counts         INTEGER                        -> BIGINT (cumulative Meta counters can exceed INT4)
--   floats         REAL (IEEE double)             -> DOUBLE PRECISION (behavioral parity with SQLite REAL)
--   json           JSON-in-TEXT                   -> JSONB
--   reporting dates YYYY-MM-DD canonical TEXT  -> TEXT (calendar dates, deliberately NOT timestamps)
--
-- Enum-like values keep their SQLite CHECK constraints verbatim.
-- No CASCADE behavior is introduced: SQLite had none.

CREATE TABLE packages (
  id                   UUID PRIMARY KEY,
  name                 TEXT NOT NULL,
  description          TEXT NOT NULL,
  metric_thresholds    JSONB NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL,
  code                 TEXT,
  collection_frequency BIGINT NOT NULL DEFAULT 1,
  max_ad_accounts      BIGINT,
  max_campaigns        BIGINT,
  retention_days       BIGINT,
  default_visible_kpis JSONB NOT NULL DEFAULT '[]',
  features             JSONB NOT NULL DEFAULT '{}',
  pricing_defaults     JSONB NOT NULL DEFAULT '{}'
);

CREATE UNIQUE INDEX idx_packages_code ON packages(code);

CREATE TABLE clients (
  id                  UUID PRIMARY KEY,
  name                TEXT NOT NULL,
  business_type       TEXT NOT NULL,
  contact_email       TEXT NOT NULL,
  package_id          UUID NOT NULL REFERENCES packages(id),
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL,
  package_assigned_at TIMESTAMPTZ
);

CREATE INDEX idx_clients_package_id ON clients(package_id);

-- Created after clients so users.client_id (migration 003) can be an
-- inline foreign key instead of a separate ALTER step.
CREATE TABLE users (
  id         UUID PRIMARY KEY,
  role       TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'client')),
  full_name  TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL,
  client_id  UUID REFERENCES clients(id)
);

CREATE TABLE admin_assignments (
  id            UUID PRIMARY KEY,
  admin_user_id UUID NOT NULL REFERENCES users(id),
  client_id     UUID NOT NULL REFERENCES clients(id),
  assigned_at   TIMESTAMPTZ NOT NULL,
  UNIQUE (admin_user_id, client_id)
);

CREATE INDEX idx_admin_assignments_admin ON admin_assignments(admin_user_id);
CREATE INDEX idx_admin_assignments_client ON admin_assignments(client_id);

CREATE TABLE ad_accounts (
  id                 UUID PRIMARY KEY,
  client_id          UUID NOT NULL REFERENCES clients(id),
  name               TEXT NOT NULL,
  status             TEXT NOT NULL CHECK (status IN ('connected', 'pending', 'error')),
  source             TEXT NOT NULL CHECK (source IN ('playwright', 'meta_api')),
  meta_ad_account_id TEXT,
  created_at         TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_ad_accounts_client_id ON ad_accounts(client_id);

CREATE TABLE campaigns (
  id               UUID PRIMARY KEY,
  ad_account_id    UUID NOT NULL REFERENCES ad_accounts(id),
  name             TEXT NOT NULL,
  objective        TEXT NOT NULL,
  status           TEXT NOT NULL,
  scraped_label    TEXT,
  meta_campaign_id TEXT,
  created_at       TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_campaigns_ad_account_id ON campaigns(ad_account_id);

CREATE TABLE insight_snapshots (
  id                 UUID PRIMARY KEY,
  campaign_id        UUID NOT NULL REFERENCES campaigns(id),
  captured_at        TIMESTAMPTZ NOT NULL,
  reporting_from     TEXT,
  reporting_to       TEXT,
  impressions        BIGINT NOT NULL,
  clicks             BIGINT NOT NULL,
  spend              DOUBLE PRECISION NOT NULL,
  ctr                DOUBLE PRECISION NOT NULL,
  cpc                DOUBLE PRECISION NOT NULL,
  cpm                DOUBLE PRECISION NOT NULL,
  reach              BIGINT NOT NULL,
  link_clicks        BIGINT NOT NULL DEFAULT 0,
  frequency          DOUBLE PRECISION NOT NULL DEFAULT 0,
  clicks_all         BIGINT NOT NULL DEFAULT 0,
  unique_clicks      BIGINT NOT NULL DEFAULT 0,
  unique_ctr         DOUBLE PRECISION NOT NULL DEFAULT 0,
  landing_page_views BIGINT NOT NULL DEFAULT 0,
  outbound_clicks    BIGINT NOT NULL DEFAULT 0,
  outbound_ctr       DOUBLE PRECISION NOT NULL DEFAULT 0,
  leads              BIGINT NOT NULL DEFAULT 0,
  messages_started   BIGINT NOT NULL DEFAULT 0,
  messages_contacts  BIGINT NOT NULL DEFAULT 0,
  results            BIGINT NOT NULL DEFAULT 0,
  cost_per_result    DOUBLE PRECISION NOT NULL DEFAULT 0,
  post_reactions     BIGINT NOT NULL DEFAULT 0,
  post_comments      BIGINT NOT NULL DEFAULT 0,
  raw_payload        JSONB
);

CREATE INDEX idx_insight_snapshots_campaign_id ON insight_snapshots(campaign_id);
CREATE INDEX idx_insight_snapshots_captured_at ON insight_snapshots(captured_at);

CREATE TABLE dashboard_preferences (
  id              UUID PRIMARY KEY,
  user_id         UUID REFERENCES users(id),
  client_id       UUID REFERENCES clients(id),
  visible_metrics JSONB NOT NULL DEFAULT '[]',
  theme           TEXT NOT NULL DEFAULT 'system',
  updated_at      TIMESTAMPTZ NOT NULL
);

CREATE TABLE audit_logs (
  id                 UUID PRIMARY KEY,
  actor_user_id      UUID NOT NULL REFERENCES users(id),
  action             TEXT NOT NULL,
  target_entity_type TEXT NOT NULL,
  target_entity_id   TEXT NOT NULL,
  metadata           JSONB,
  created_at         TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_user_id);
CREATE INDEX idx_audit_logs_target ON audit_logs(target_entity_type, target_entity_id);

CREATE TABLE collector_jobs (
  id             UUID PRIMARY KEY,
  ad_account_id  UUID NOT NULL REFERENCES ad_accounts(id),
  source         TEXT NOT NULL CHECK (source IN ('playwright', 'meta_api')),
  status         TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  started_at     TIMESTAMPTZ NOT NULL,
  finished_at    TIMESTAMPTZ,
  error_message  TEXT
);

CREATE INDEX idx_collector_jobs_ad_account_id ON collector_jobs(ad_account_id);

CREATE TABLE pricing_rules (
  id                     UUID PRIMARY KEY,
  client_id              UUID NOT NULL REFERENCES clients(id),
  metric                 TEXT NOT NULL CHECK (metric IN ('spend', 'cpc', 'cpm', 'costPerResult')),
  percentage_markup      DOUBLE PRECISION,
  fixed_markup           DOUBLE PRECISION,
  minimum_customer_value DOUBLE PRECISION,
  effective_from         TIMESTAMPTZ NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL,
  updated_at             TIMESTAMPTZ NOT NULL,
  CHECK (
    percentage_markup IS NOT NULL OR
    fixed_markup IS NOT NULL OR
    minimum_customer_value IS NOT NULL
  )
);

CREATE INDEX idx_pricing_rules_client ON pricing_rules(client_id, effective_from);
