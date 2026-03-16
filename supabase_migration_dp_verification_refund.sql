-- Migration: DP verification + DP refund tracking for cancelled bookings

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS dp_verified_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS dp_verified_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS dp_refund_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS dp_refunded_at TIMESTAMPTZ DEFAULT NULL;

UPDATE public.bookings
SET dp_verified_amount = COALESCE(dp_paid, 0),
    dp_verified_at = COALESCE(created_at, NOW())
WHERE COALESCE(dp_paid, 0) > 0
  AND COALESCE(dp_verified_amount, 0) = 0
  AND dp_verified_at IS NULL;

UPDATE public.bookings
SET dp_refund_amount = GREATEST(COALESCE(dp_refund_amount, 0), 0),
    dp_verified_amount = GREATEST(COALESCE(dp_verified_amount, 0), 0)
WHERE COALESCE(dp_refund_amount, 0) < 0
   OR COALESCE(dp_verified_amount, 0) < 0;

UPDATE public.bookings
SET dp_refund_amount = LEAST(COALESCE(dp_refund_amount, 0), COALESCE(dp_verified_amount, 0))
WHERE COALESCE(dp_refund_amount, 0) > COALESCE(dp_verified_amount, 0);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND constraint_name = 'bookings_dp_verified_amount_nonnegative'
  ) THEN
    ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_dp_verified_amount_nonnegative
    CHECK (COALESCE(dp_verified_amount, 0) >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND constraint_name = 'bookings_dp_refund_amount_nonnegative'
  ) THEN
    ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_dp_refund_amount_nonnegative
    CHECK (COALESCE(dp_refund_amount, 0) >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND constraint_name = 'bookings_dp_refund_not_exceed_verified'
  ) THEN
    ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_dp_refund_not_exceed_verified
    CHECK (COALESCE(dp_refund_amount, 0) <= COALESCE(dp_verified_amount, 0));
  END IF;
END $$;
