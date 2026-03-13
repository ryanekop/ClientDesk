-- ========================================================
-- Migration: Add booking form Terms & Conditions settings
-- ========================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS form_terms_enabled BOOLEAN DEFAULT false;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS form_terms_agreement_text TEXT;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS form_terms_link_text TEXT;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS form_terms_suffix_text TEXT;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS form_terms_content TEXT;
