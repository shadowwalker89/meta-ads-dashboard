-- 010_add_auth_id_to_users.sql
ALTER TABLE users ADD COLUMN auth_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id) WHERE auth_id IS NOT NULL;
