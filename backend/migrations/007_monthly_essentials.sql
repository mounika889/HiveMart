-- ============================================================
-- Migration 007: Customer Monthly Essentials & Smart Reminders
-- ============================================================

-- 1. Monthly Essentials Lists
CREATE TABLE IF NOT EXISTS monthly_essentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT 'My Monthly Essentials',
    shopping_day INTEGER NOT NULL CHECK (shopping_day >= 1 AND shopping_day <= 31),
    reminder_days_before INTEGER NOT NULL DEFAULT 3 CHECK (reminder_days_before >= 1 AND reminder_days_before <= 14),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monthly_essentials_user_id ON monthly_essentials(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_essentials_active ON monthly_essentials(is_active);

-- 2. Monthly Essential Items (Products & Recurring Quantities)
CREATE TABLE IF NOT EXISTS monthly_essential_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID NOT NULL REFERENCES monthly_essentials(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_monthly_essential_items_list_prod UNIQUE (list_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_monthly_essential_items_list_id ON monthly_essential_items(list_id);
CREATE INDEX IF NOT EXISTS idx_monthly_essential_items_prod_id ON monthly_essential_items(product_id);

-- 3. Monthly Reminders & Tracking
CREATE TABLE IF NOT EXISTS monthly_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID NOT NULL REFERENCES monthly_essentials(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    due_date DATE NOT NULL,
    reminder_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'READ', 'DISMISSED')),
    read_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_monthly_reminders_list_due UNIQUE (list_id, due_date)
);

CREATE INDEX IF NOT EXISTS idx_monthly_reminders_user_status ON monthly_reminders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_monthly_reminders_list_id ON monthly_reminders(list_id);
CREATE INDEX IF NOT EXISTS idx_monthly_reminders_due_date ON monthly_reminders(due_date);

