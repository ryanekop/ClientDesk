-- Migration: Add original_price column to services table
-- Purpose: Support strikethrough/crossed-out pricing in booking form
-- NULL = no strikethrough price shown
ALTER TABLE services ADD COLUMN IF NOT EXISTS original_price numeric DEFAULT NULL;
