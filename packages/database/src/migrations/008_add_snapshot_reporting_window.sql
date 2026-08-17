-- 008_add_snapshot_reporting_window.sql
-- Persist the reporting window Meta supplies in its CSV export
-- ("Reporting starts" / "Reporting ends"), confirmed YYYY-MM-DD.
--
-- Both columns are nullable and stay NULL when Meta provides no value.
-- `captured_at` remains the collection timestamp and is never a
-- substitute for either boundary. Stored as canonical YYYY-MM-DD TEXT,
-- matching the project's TEXT date convention.

ALTER TABLE insight_snapshots ADD COLUMN reporting_from TEXT;
ALTER TABLE insight_snapshots ADD COLUMN reporting_to TEXT;