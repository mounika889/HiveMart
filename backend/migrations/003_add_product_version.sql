-- Migration: 003_add_product_version.sql
-- Description: Add monotonic version column to products for atomic OpenSearch synchronization concurrency control

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 10;

