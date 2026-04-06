-- ========================================================
-- Migration: Replace separate bank columns with JSONB array
-- ========================================================

-- Drop old columns if they exist (from previous migration)
ALTER TABLE profiles DROP COLUMN IF EXISTS bank_name;
ALTER TABLE profiles DROP COLUMN IF EXISTS bank_account_number;
ALTER TABLE profiles DROP COLUMN IF EXISTS bank_account_name;

-- Add JSONB array column for multiple bank accounts (max 5)
-- Format: [{"bank_name": "BCA", "account_number": "1234567890", "account_name": "John Doe"}, ...]
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_accounts JSONB DEFAULT '[]'::jsonb;
