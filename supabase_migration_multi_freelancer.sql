-- ========================================================
-- Migration: Multi-Freelancer Support (max 5 per booking)
-- ========================================================

-- 1. Canonicalize legacy table name if needed.
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

-- 2. Create canonical junction table
CREATE TABLE IF NOT EXISTS booking_freelance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  freelance_id UUID NOT NULL REFERENCES freelance(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(booking_id, freelance_id)
);

-- 3. Migrate existing single-FK data to junction table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND column_name = 'freelance_id'
  ) THEN
    INSERT INTO booking_freelance (booking_id, freelance_id)
    SELECT id, freelance_id
    FROM bookings
    WHERE freelance_id IS NOT NULL
    ON CONFLICT (booking_id, freelance_id) DO NOTHING;
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND column_name = 'freelancer_id'
  ) THEN
    INSERT INTO booking_freelance (booking_id, freelance_id)
    SELECT id, freelancer_id
    FROM bookings
    WHERE freelancer_id IS NOT NULL
    ON CONFLICT (booking_id, freelance_id) DO NOTHING;
  END IF;
END $$;

-- 4. Merge rows from legacy junction table when both exist.
DO $$
BEGIN
  IF to_regclass('public.booking_freelancers') IS NOT NULL
     AND to_regclass('public.booking_freelance') IS NOT NULL THEN
    INSERT INTO booking_freelance (booking_id, freelance_id, created_at)
    SELECT booking_id, freelancer_id, created_at
    FROM booking_freelancers
    ON CONFLICT (booking_id, freelance_id) DO NOTHING;
  END IF;
END $$;

-- 5. (Optional) Drop legacy column after confirming migration
-- ALTER TABLE bookings DROP COLUMN freelancer_id;
-- For now, keep the old column for backward compatibility
