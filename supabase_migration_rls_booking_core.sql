-- ========================================================
-- Migration: Enable RLS for booking core tables (owner-only)
-- Scope: bookings, services, freelance, booking_services, booking_freelance
-- ========================================================

BEGIN;

-- Safety gate: abort migration when data shape is not ready for strict owner RLS.
DO $$
DECLARE
  v_bookings_null BIGINT;
  v_services_null BIGINT;
  v_freelance_null BIGINT;
  v_booking_services_orphan BIGINT;
  v_booking_freelance_orphan BIGINT;
  v_booking_services_mismatch BIGINT;
  v_booking_freelance_mismatch BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_bookings_null
  FROM public.bookings
  WHERE user_id IS NULL;

  SELECT COUNT(*) INTO v_services_null
  FROM public.services
  WHERE user_id IS NULL;

  SELECT COUNT(*) INTO v_freelance_null
  FROM public.freelance
  WHERE user_id IS NULL;

  SELECT COUNT(*) INTO v_booking_services_orphan
  FROM public.booking_services bs
  LEFT JOIN public.bookings b ON b.id = bs.booking_id
  LEFT JOIN public.services s ON s.id = bs.service_id
  WHERE b.id IS NULL OR s.id IS NULL;

  SELECT COUNT(*) INTO v_booking_freelance_orphan
  FROM public.booking_freelance bf
  LEFT JOIN public.bookings b ON b.id = bf.booking_id
  LEFT JOIN public.freelance f ON f.id = bf.freelance_id
  WHERE b.id IS NULL OR f.id IS NULL;

  SELECT COUNT(*) INTO v_booking_services_mismatch
  FROM public.booking_services bs
  JOIN public.bookings b ON b.id = bs.booking_id
  JOIN public.services s ON s.id = bs.service_id
  WHERE b.user_id IS DISTINCT FROM s.user_id;

  SELECT COUNT(*) INTO v_booking_freelance_mismatch
  FROM public.booking_freelance bf
  JOIN public.bookings b ON b.id = bf.booking_id
  JOIN public.freelance f ON f.id = bf.freelance_id
  WHERE b.user_id IS DISTINCT FROM f.user_id;

  IF v_bookings_null > 0
    OR v_services_null > 0
    OR v_freelance_null > 0
    OR v_booking_services_orphan > 0
    OR v_booking_freelance_orphan > 0
    OR v_booking_services_mismatch > 0
    OR v_booking_freelance_mismatch > 0
  THEN
    RAISE EXCEPTION
      'RLS preflight failed: bookings_null=% services_null=% freelance_null=% booking_services_orphan=% booking_freelance_orphan=% booking_services_mismatch=% booking_freelance_mismatch=%',
      v_bookings_null,
      v_services_null,
      v_freelance_null,
      v_booking_services_orphan,
      v_booking_freelance_orphan,
      v_booking_services_mismatch,
      v_booking_freelance_mismatch;
  END IF;
END
$$;

-- Enable RLS (service_role still bypasses by default; no FORCE RLS)
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freelance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_freelance ENABLE ROW LEVEL SECURITY;

-- bookings policies
DROP POLICY IF EXISTS bookings_select_own ON public.bookings;
DROP POLICY IF EXISTS bookings_insert_own ON public.bookings;
DROP POLICY IF EXISTS bookings_update_own ON public.bookings;
DROP POLICY IF EXISTS bookings_delete_own ON public.bookings;

CREATE POLICY bookings_select_own
ON public.bookings
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY bookings_insert_own
ON public.bookings
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY bookings_update_own
ON public.bookings
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY bookings_delete_own
ON public.bookings
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- services policies
DROP POLICY IF EXISTS services_select_own ON public.services;
DROP POLICY IF EXISTS services_insert_own ON public.services;
DROP POLICY IF EXISTS services_update_own ON public.services;
DROP POLICY IF EXISTS services_delete_own ON public.services;

CREATE POLICY services_select_own
ON public.services
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY services_insert_own
ON public.services
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY services_update_own
ON public.services
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY services_delete_own
ON public.services
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- freelance policies
DROP POLICY IF EXISTS freelance_select_own ON public.freelance;
DROP POLICY IF EXISTS freelance_insert_own ON public.freelance;
DROP POLICY IF EXISTS freelance_update_own ON public.freelance;
DROP POLICY IF EXISTS freelance_delete_own ON public.freelance;

CREATE POLICY freelance_select_own
ON public.freelance
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY freelance_insert_own
ON public.freelance
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY freelance_update_own
ON public.freelance
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY freelance_delete_own
ON public.freelance
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- booking_services policies
DROP POLICY IF EXISTS booking_services_select_own ON public.booking_services;
DROP POLICY IF EXISTS booking_services_insert_own ON public.booking_services;
DROP POLICY IF EXISTS booking_services_update_own ON public.booking_services;
DROP POLICY IF EXISTS booking_services_delete_own ON public.booking_services;

CREATE POLICY booking_services_select_own
ON public.booking_services
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_services.booking_id
      AND b.user_id = auth.uid()
  )
);

CREATE POLICY booking_services_insert_own
ON public.booking_services
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_services.booking_id
      AND b.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1
    FROM public.services s
    WHERE s.id = booking_services.service_id
      AND s.user_id = auth.uid()
  )
);

CREATE POLICY booking_services_update_own
ON public.booking_services
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_services.booking_id
      AND b.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_services.booking_id
      AND b.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1
    FROM public.services s
    WHERE s.id = booking_services.service_id
      AND s.user_id = auth.uid()
  )
);

CREATE POLICY booking_services_delete_own
ON public.booking_services
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_services.booking_id
      AND b.user_id = auth.uid()
  )
);

-- booking_freelance policies
DROP POLICY IF EXISTS booking_freelance_select_own ON public.booking_freelance;
DROP POLICY IF EXISTS booking_freelance_insert_own ON public.booking_freelance;
DROP POLICY IF EXISTS booking_freelance_update_own ON public.booking_freelance;
DROP POLICY IF EXISTS booking_freelance_delete_own ON public.booking_freelance;

CREATE POLICY booking_freelance_select_own
ON public.booking_freelance
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_freelance.booking_id
      AND b.user_id = auth.uid()
  )
);

CREATE POLICY booking_freelance_insert_own
ON public.booking_freelance
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_freelance.booking_id
      AND b.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1
    FROM public.freelance f
    WHERE f.id = booking_freelance.freelance_id
      AND f.user_id = auth.uid()
  )
);

CREATE POLICY booking_freelance_update_own
ON public.booking_freelance
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_freelance.booking_id
      AND b.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_freelance.booking_id
      AND b.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1
    FROM public.freelance f
    WHERE f.id = booking_freelance.freelance_id
      AND f.user_id = auth.uid()
  )
);

CREATE POLICY booking_freelance_delete_own
ON public.booking_freelance
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_freelance.booking_id
      AND b.user_id = auth.uid()
  )
);

COMMIT;
