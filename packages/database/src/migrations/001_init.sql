-- 001_init.sql
-- Initial schema, generated strictly from docs/domain-model.md.
-- One table per Aggregate Root / entity. No columns added beyond
-- what the domain model and repository interfaces require.

CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  role       TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'client')),
  full_name  TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS packages (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  description        TEXT NOT NULL,
  metric_thresholds  TEXT NOT NULL DEFAULT '{}',
  created_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  business_type  TEXT NOT NULL,
  contact_email  TEXT NOT NULL,
  package_id     TEXT NOT NULL REFERENCES packages(id),
  is_active      INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_clients_package_id ON clients(package_id);

CREATE TABLE IF NOT EXISTS admin_assignments (
  id             TEXT PRIMARY KEY,
  admin_user_id  TEXT NOT NULL REFERENCES users(id),
  client_id      TEXT NOT NULL REFERENCES clients(id),
  assigned_at    TEXT NOT NULL,
  UNIQUE (admin_user_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_assignments_admin ON admin_assignments(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_assignments_client ON admin_assignments(client_id);

CREATE TABLE IF NOT EXISTS ad_accounts (
  id                 TEXT PRIMARY KEY,
  client_id          TEXT NOT NULL REFERENCES clients(id),
  name               TEXT NOT NULL,
  status             TEXT NOT NULL CHECK (status IN ('connected', 'pending', 'error')),
  source             TEXT NOT NULL CHECK (source IN ('playwright', 'meta_api')),
  meta_ad_account_id TEXT,
  created_at         TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ad_accounts_client_id ON ad_accounts(client_id);

CREATE TABLE IF NOT EXISTS campaigns (
  id               TEXT PRIMARY KEY,
  ad_account_id    TEXT NOT NULL REFERENCES ad_accounts(id),
  name             TEXT NOT NULL,
  objective        TEXT NOT NULL,
  status           TEXT NOT NULL,
  scraped_label    TEXT,
  meta_campaign_id TEXT,
  created_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_campaigns_ad_account_id ON campaigns(ad_account_id);

CREATE TABLE IF NOT EXISTS insight_snapshots (
  id           TEXT PRIMARY KEY,
  campaign_id  TEXT NOT NULL REFERENCES campaigns(id),
  captured_at  TEXT NOT NULL,
  impressions  INTEGER NOT NULL,
  clicks       INTEGER NOT NULL,
  spend        REAL NOT NULL,
  ctr          REAL NOT NULL,
  cpc          REAL NOT NULL,
  cpm          REAL NOT NULL,
  reach        INTEGER NOT NULL,
  raw_payload  TEXT
);

CREATE INDEX IF NOT EXISTS idx_insight_snapshots_campaign_id ON insight_snapshots(campaign_id);
CREATE INDEX IF NOT EXISTS idx_insight_snapshots_captured_at ON insight_snapshots(captured_at);

CREATE TABLE IF NOT EXISTS dashboard_preferences (
  id               TEXT PRIMARY KEY,
  user_id          TEXT REFERENCES users(id),
  client_id        TEXT REFERENCES clients(id),
  visible_metrics  TEXT NOT NULL DEFAULT '[]',
  theme            TEXT NOT NULL DEFAULT 'system',
  updated_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id                  TEXT PRIMARY KEY,
  actor_user_id       TEXT NOT NULL REFERENCES users(id),
  action              TEXT NOT NULL,
  target_entity_type  TEXT NOT NULL,
  target_entity_id    TEXT NOT NULL,
  metadata            TEXT,
  created_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_entity_type, target_entity_id);

CREATE TABLE IF NOT EXISTS collector_jobs (
  id             TEXT PRIMARY KEY,
  ad_account_id  TEXT NOT NULL REFERENCES ad_accounts(id),
  source         TEXT NOT NULL CHECK (source IN ('playwright', 'meta_api')),
  status         TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  started_at     TEXT NOT NULL,
  finished_at    TEXT,
  error_message  TEXT
);

CREATE INDEX IF NOT EXISTS idx_collector_jobs_ad_account_id ON collector_jobs(ad_account_id);
