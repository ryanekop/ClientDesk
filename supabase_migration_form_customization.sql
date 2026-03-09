-- ========================================================
-- Migration: Add form customization fields to profiles
-- ========================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS form_brand_color TEXT DEFAULT '#000000';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS form_greeting TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS form_event_types TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS form_show_location BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS form_show_notes BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS form_show_proof BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invoice_logo_url TEXT;
