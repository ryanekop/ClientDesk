-- ============================================================
-- Migration: Canonical table naming for freelance entities
-- Ensures we use: freelance / booking_freelance / freelance_id
-- ============================================================

-- 1) Rename legacy tables when canonical table is not present yet.
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

-- 2) Rename legacy columns where possible.
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

-- 3) If both tables exist, merge data from accidental duplicate (`freelancers`)
-- into canonical table (`freelance`).
DO $$
BEGIN
  IF to_regclass('public.freelancers') IS NOT NULL
     AND to_regclass('public.freelance') IS NOT NULL THEN
    INSERT INTO public.freelance (
      id,
      user_id,
      name,
      role,
      whatsapp_number,
      status,
      created_at
    )
    SELECT
      legacy.id,
      legacy.user_id,
      legacy.name,
      legacy.role,
      legacy.whatsapp_number,
      COALESCE(legacy.status, 'active'),
      COALESCE(legacy.created_at, NOW())
    FROM public.freelancers legacy
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- 4) Drop duplicate legacy table only when it is safe.
DO $$
BEGIN
  IF to_regclass('public.freelancers') IS NOT NULL
     AND to_regclass('public.freelance') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.freelancers legacy
       LEFT JOIN public.freelance current ON current.id = legacy.id
       WHERE current.id IS NULL
     )
     AND NOT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'bookings'
         AND column_name = 'freelancer_id'
     )
     AND to_regclass('public.booking_freelancers') IS NULL THEN
    EXECUTE 'DROP TABLE public.freelancers';
  END IF;
END $$;
