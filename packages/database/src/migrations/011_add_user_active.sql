-- 011_add_user_active.sql
ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
