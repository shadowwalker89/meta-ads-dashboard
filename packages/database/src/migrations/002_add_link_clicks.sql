-- 002_add_link_clicks.sql
-- Adds the separate "Link clicks" metric alongside the existing
-- "Clicks (all)" (clicks) column. Two genuinely different Meta
-- metrics, kept as two columns per explicit product decision
-- (2026-08-08) to show both to clients.

ALTER TABLE insight_snapshots ADD COLUMN link_clicks INTEGER NOT NULL DEFAULT 0;
