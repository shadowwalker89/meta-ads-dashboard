-- 007_add_package_assigned_at.sql
-- Package Assignment Foundation: records when the client's CURRENT
-- package was assigned, so future package changes and package
-- pricing-default propagation know the assignment time.
--
-- Existing rows are backfilled conservatively: a client is treated as
-- having been assigned at creation — the only safe assumption for rows
-- created before this column existed. New clients are stamped at
-- creation and re-stamped on reassignment by the repository.

ALTER TABLE clients ADD COLUMN package_assigned_at TEXT;

UPDATE clients
SET package_assigned_at = created_at
WHERE package_assigned_at IS NULL;