-- 003_add_client_id_to_users.sql
-- Links a client-role user to its Client explicitly.
-- Nullable because super_admin and admin users do not belong
-- to exactly one client.

ALTER TABLE users ADD COLUMN client_id TEXT REFERENCES clients(id);