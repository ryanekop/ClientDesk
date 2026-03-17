-- ============================================================
-- Migration: Rename freelancers → freelance, booking_freelancers → booking_freelance
-- Also: Add content_en and event_type columns to templates
-- ============================================================

-- 1. Rename tables (idempotent)
DO $$
BEGIN
  IF to_regclass('public.freelance') IS NULL
     AND to_regclass('public.freelancers') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.freelancers RENAME TO freelance';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.booking_freelance') IS NULL
     AND to_regclass('public.booking_freelancers') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.booking_freelancers RENAME TO booking_freelance';
  END IF;
END $$;

-- 2. Rename freelancer_id column in booking_freelance junction table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'booking_freelance'
      AND column_name = 'freelancer_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'booking_freelance'
      AND column_name = 'freelance_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.booking_freelance RENAME COLUMN freelancer_id TO freelance_id';
  END IF;
END $$;

-- 3. Rename freelancer_id column in bookings table (old FK, backward compat)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND column_name = 'freelancer_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND column_name = 'freelance_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.bookings RENAME COLUMN freelancer_id TO freelance_id';
  END IF;
END $$;

-- 4. Add bilingual + event type support to templates
ALTER TABLE templates ADD COLUMN IF NOT EXISTS content_en text DEFAULT '';
ALTER TABLE templates ADD COLUMN IF NOT EXISTS event_type text DEFAULT NULL;
