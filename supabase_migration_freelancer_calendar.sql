-- ========================================================
-- Migration: Add google_email for Calendar integration
-- ========================================================

DO $$
BEGIN
  IF to_regclass('public.freelance') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.freelance ADD COLUMN IF NOT EXISTS google_email TEXT';
  ELSIF to_regclass('public.freelancers') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.freelancers ADD COLUMN IF NOT EXISTS google_email TEXT';
  END IF;
END $$;
