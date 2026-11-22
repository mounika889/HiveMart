-- Migration: 002_add_carts_unique_user.sql
-- Description: Enforce one persistent cart per user constraint

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_carts_user_id'
    ) THEN
        ALTER TABLE carts ADD CONSTRAINT uq_carts_user_id UNIQUE (user_id);
    END IF;
END $$;

