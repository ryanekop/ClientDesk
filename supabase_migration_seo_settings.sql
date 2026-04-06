-- ========================================================
-- Migration: Add SEO settings fields to profiles
-- ========================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seo_meta_title TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seo_meta_description TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seo_meta_keywords TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seo_og_image_url TEXT;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seo_form_meta_title TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seo_form_meta_description TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seo_form_meta_keywords TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seo_form_og_image_url TEXT;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seo_track_meta_title TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seo_track_meta_description TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seo_track_meta_keywords TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seo_track_og_image_url TEXT;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seo_settlement_meta_title TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seo_settlement_meta_description TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seo_settlement_meta_keywords TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seo_settlement_og_image_url TEXT;
