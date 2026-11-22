-- ============================================================
-- Migration 006: Smart Warehouse Inventory Alerts, Threshold Settings,
-- Demand Notifications, and Monthly Bestseller Analytics
-- ============================================================

-- 1. Stock Alert Settings Table (per-product, per-city configurable thresholds)
CREATE TABLE IF NOT EXISTS stock_alert_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    city VARCHAR(64) NOT NULL CHECK (city IN ('Bengaluru', 'Hyderabad', 'Chennai', 'Mumbai', 'Delhi')),
    early_warning_threshold INTEGER NOT NULL DEFAULT 20 CHECK (early_warning_threshold >= 0),
    minimum_stock_threshold INTEGER NOT NULL DEFAULT 10 CHECK (minimum_stock_threshold >= 0),
    critical_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (critical_stock_threshold >= 0),
    enabled BOOLEAN NOT NULL DEFAULT true,
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_stock_alert_settings_product_city UNIQUE (product_id, city),
    CONSTRAINT chk_threshold_hierarchy CHECK (
        early_warning_threshold >= minimum_stock_threshold AND 
        minimum_stock_threshold >= critical_stock_threshold
    )
);

CREATE INDEX IF NOT EXISTS idx_stock_alert_settings_city ON stock_alert_settings(city);
CREATE INDEX IF NOT EXISTS idx_stock_alert_settings_product_id ON stock_alert_settings(product_id);

-- 2. Inventory Alerts Table (active, acknowledged, and resolved lifecycle)
CREATE TABLE IF NOT EXISTS inventory_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    city VARCHAR(64) NOT NULL CHECK (city IN ('Bengaluru', 'Hyderabad', 'Chennai', 'Mumbai', 'Delhi')),
    alert_type VARCHAR(64) NOT NULL CHECK (
        alert_type IN ('REORDER_SOON', 'LOW_STOCK', 'CRITICAL_STOCK', 'OUT_OF_STOCK', 'BESTSELLER_REPLENISHMENT')
    ),
    severity VARCHAR(32) NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL', 'URGENT')),
    current_stock INTEGER NOT NULL CHECK (current_stock >= 0),
    threshold_value INTEGER NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED')),
    details JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ NULL,
    acknowledged_at TIMESTAMPTZ NULL,
    acknowledged_by UUID NULL REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_inventory_alerts_city_status ON inventory_alerts(city, status);
CREATE INDEX IF NOT EXISTS idx_inventory_alerts_product_id ON inventory_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_alerts_created_at ON inventory_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_alerts_type ON inventory_alerts(alert_type);

-- Atomic uniqueness: only 1 active or acknowledged alert per condition per product & city
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_alert_prod_city_type 
    ON inventory_alerts(product_id, city, alert_type) 
    WHERE status IN ('ACTIVE', 'ACKNOWLEDGED');

-- 3. Notifications Table (delivered to specific retailers / admins)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alert_id UUID NULL REFERENCES inventory_alerts(id) ON DELETE CASCADE,
    notification_type VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread ON notifications(recipient_user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_alert_id ON notifications(alert_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- 4. Sales Analytics Daily Aggregations Table
CREATE TABLE IF NOT EXISTS sales_analytics_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    city VARCHAR(64) NOT NULL CHECK (city IN ('Bengaluru', 'Hyderabad', 'Chennai', 'Mumbai', 'Delhi')),
    sales_date DATE NOT NULL,
    online_units INTEGER NOT NULL DEFAULT 0 CHECK (online_units >= 0),
    offline_units INTEGER NOT NULL DEFAULT 0 CHECK (offline_units >= 0),
    total_units INTEGER NOT NULL DEFAULT 0 CHECK (total_units >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_sales_analytics_prod_city_date UNIQUE (product_id, city, sales_date)
);

CREATE INDEX IF NOT EXISTS idx_sales_analytics_city_date ON sales_analytics_daily(city, sales_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_analytics_prod_date ON sales_analytics_daily(product_id, sales_date DESC);

