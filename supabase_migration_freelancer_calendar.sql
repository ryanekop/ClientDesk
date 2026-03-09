-- ========================================================
-- Migration: Add google_email to freelancers for Calendar integration
-- ========================================================

ALTER TABLE freelancers ADD COLUMN IF NOT EXISTS google_email TEXT;
