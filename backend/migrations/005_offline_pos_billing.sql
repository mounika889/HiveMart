-- ============================================================
-- Migration 005: Offline Retail POS Billing, Mandatory Finalization,
-- Centralized Warehouse Deduction and Inventory Movements Audit
-- ============================================================

-- 1. Bill Number Sequence for concurrency-safe unique numbers
CREATE SEQUENCE IF NOT EXISTS offline_bill_seq START 1001;

-- 2. Offline Bills Table
CREATE TABLE IF NOT EXISTS offline_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_number VARCHAR(64) NOT NULL UNIQUE,
    retailer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    city VARCHAR(64) NOT NULL CHECK (city IN ('Bengaluru', 'Hyderabad', 'Chennai', 'Mumbai', 'Delhi')),
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'FINALIZED', 'CANCELLED')),
    payment_method VARCHAR(32) NOT NULL DEFAULT 'CASH' CHECK (payment_method IN ('CASH', 'CARD', 'UPI', 'STORE_TERMINAL')),
    subtotal_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    idempotency_key VARCHAR(255) NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finalized_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_offline_bills_retailer_id ON offline_bills(retailer_id);
CREATE INDEX IF NOT EXISTS idx_offline_bills_city ON offline_bills(city);
CREATE INDEX IF NOT EXISTS idx_offline_bills_status ON offline_bills(status);
CREATE INDEX IF NOT EXISTS idx_offline_bills_idempotency ON offline_bills(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_offline_bills_created_at ON offline_bills(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_offline_bills_retailer_idempotency 
    ON offline_bills(retailer_id, idempotency_key) 
    WHERE idempotency_key IS NOT NULL AND status = 'FINALIZED';

-- 3. Offline Bill Items Table (with immutable product snapshots)
CREATE TABLE IF NOT EXISTS offline_bill_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES offline_bills(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name_snapshot VARCHAR(255) NOT NULL,
    unit_price_snapshot NUMERIC(10, 2) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    line_total NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offline_bill_items_bill_id ON offline_bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_offline_bill_items_product_id ON offline_bill_items(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_offline_bill_items_bill_product ON offline_bill_items(bill_id, product_id);

-- 4. Offline Sales Table (one completed sale per finalized bill)
CREATE TABLE IF NOT EXISTS offline_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL UNIQUE REFERENCES offline_bills(id) ON DELETE RESTRICT,
    retailer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    city VARCHAR(64) NOT NULL CHECK (city IN ('Bengaluru', 'Hyderabad', 'Chennai', 'Mumbai', 'Delhi')),
    total_amount NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offline_sales_retailer_id ON offline_sales(retailer_id);
CREATE INDEX IF NOT EXISTS idx_offline_sales_city ON offline_sales(city);
CREATE INDEX IF NOT EXISTS idx_offline_sales_created_at ON offline_sales(created_at DESC);

-- 5. Inventory Movements Audit Table (immutable ledger for stock changes)
CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    city VARCHAR(64) NOT NULL CHECK (city IN ('Bengaluru', 'Hyderabad', 'Chennai', 'Mumbai', 'Delhi')),
    movement_type VARCHAR(32) NOT NULL CHECK (movement_type IN ('ONLINE_SALE', 'OFFLINE_SALE', 'ADJUSTMENT')),
    quantity_delta INTEGER NOT NULL,
    quantity_before INTEGER NOT NULL,
    quantity_after INTEGER NOT NULL,
    source_type VARCHAR(32) NOT NULL,
    source_id VARCHAR(255) NOT NULL,
    performed_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_inv_movement_source UNIQUE (source_type, source_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_inv_movements_product_city ON inventory_movements(product_id, city);
CREATE INDEX IF NOT EXISTS idx_inv_movements_created_at ON inventory_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_movements_source ON inventory_movements(source_type, source_id);

