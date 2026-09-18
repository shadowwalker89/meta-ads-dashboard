-- 003_add_auth_id_to_users_pg.sql
ALTER TABLE users ADD COLUMN auth_id UUID;
CREATE UNIQUE INDEX idx_users_auth_id ON users(auth_id) WHERE auth_id IS NOT NULL;
