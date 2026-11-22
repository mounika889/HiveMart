-- Migration: 004_role_based_access_and_retailers.sql
-- Description: Expand role-based access control with RETAILER support, active user flags, and retailer_profiles

-- 1. Update users role check constraint to support customer, retailer, and admin
DO $$
BEGIN
    -- Drop existing check constraint if it exists
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    
    -- Add updated check constraint supporting customer, retailer, and admin (case-insensitive)
    ALTER TABLE users ADD CONSTRAINT users_role_check 
        CHECK (LOWER(role) IN ('customer', 'retailer', 'admin'));
END $$;

-- 2. Add is_active column to users table if missing
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 3. Ensure existing users have customer role if null
UPDATE users SET role = 'customer' WHERE role IS NULL;

-- 4. Create retailer_profiles table
CREATE TABLE IF NOT EXISTS retailer_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_city VARCHAR(100) NOT NULL CHECK (LOWER(assigned_city) IN ('bengaluru', 'hyderabad', 'chennai', 'mumbai', 'delhi')),
    approval_status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_retailer_profiles_user UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_retailer_profiles_user_id ON retailer_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_retailer_profiles_status ON retailer_profiles(approval_status);
CREATE INDEX IF NOT EXISTS idx_retailer_profiles_city ON retailer_profiles(assigned_city);

