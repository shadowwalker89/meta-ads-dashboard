-- 004_expand_insight_metrics.sql
-- Adds the extended Meta Ads metric set to insight_snapshots.
-- Every new column is NOT NULL DEFAULT 0 so existing rows migrate
-- cleanly and old snapshots read back as 0, never NULL/undefined.

ALTER TABLE insight_snapshots ADD COLUMN frequency REAL NOT NULL DEFAULT 0;
ALTER TABLE insight_snapshots ADD COLUMN clicks_all INTEGER NOT NULL DEFAULT 0;
ALTER TABLE insight_snapshots ADD COLUMN unique_clicks INTEGER NOT NULL DEFAULT 0;
ALTER TABLE insight_snapshots ADD COLUMN unique_ctr REAL NOT NULL DEFAULT 0;
ALTER TABLE insight_snapshots ADD COLUMN landing_page_views INTEGER NOT NULL DEFAULT 0;
ALTER TABLE insight_snapshots ADD COLUMN outbound_clicks INTEGER NOT NULL DEFAULT 0;
ALTER TABLE insight_snapshots ADD COLUMN outbound_ctr REAL NOT NULL DEFAULT 0;
ALTER TABLE insight_snapshots ADD COLUMN leads INTEGER NOT NULL DEFAULT 0;
ALTER TABLE insight_snapshots ADD COLUMN messages_started INTEGER NOT NULL DEFAULT 0;
ALTER TABLE insight_snapshots ADD COLUMN messages_contacts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE insight_snapshots ADD COLUMN results INTEGER NOT NULL DEFAULT 0;
ALTER TABLE insight_snapshots ADD COLUMN cost_per_result REAL NOT NULL DEFAULT 0;
ALTER TABLE insight_snapshots ADD COLUMN post_reactions INTEGER NOT NULL DEFAULT 0;
ALTER TABLE insight_snapshots ADD COLUMN post_comments INTEGER NOT NULL DEFAULT 0;