-- ========================================================
-- Migration: Restrict booking writes for expired subscriptions
-- Scope: bookings, booking_services, booking_freelance
-- ========================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.user_can_write_bookings(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN FALSE
    WHEN auth.uid() <> target_user_id THEN FALSE
    WHEN NOT EXISTS (
      SELECT 1
      FROM public.subscriptions s
      WHERE s.user_id = target_user_id
    ) THEN TRUE
    ELSE EXISTS (
      SELECT 1
      FROM public.subscriptions s
      WHERE s.user_id = target_user_id
        AND (
          s.tier = 'lifetime'
          OR (
            s.status = 'active'
            AND s.end_date IS NOT NULL
            AND s.end_date >= NOW()
          )
          OR (
            s.status = 'trial'
            AND s.trial_end_date IS NOT NULL
            AND s.trial_end_date >= NOW()
          )
        )
    )
  END
$$;

REVOKE ALL ON FUNCTION public.user_can_write_bookings(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_write_bookings(uuid) TO authenticated;

DROP POLICY IF EXISTS bookings_insert_own ON public.bookings;
DROP POLICY IF EXISTS bookings_update_own ON public.bookings;
DROP POLICY IF EXISTS bookings_delete_own ON public.bookings;

CREATE POLICY bookings_insert_own
ON public.bookings
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.user_can_write_bookings(user_id)
);

CREATE POLICY bookings_update_own
ON public.bookings
FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  AND public.user_can_write_bookings(user_id)
)
WITH CHECK (
  user_id = auth.uid()
  AND public.user_can_write_bookings(user_id)
);

CREATE POLICY bookings_delete_own
ON public.bookings
FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  AND public.user_can_write_bookings(user_id)
);

DROP POLICY IF EXISTS booking_services_insert_own ON public.booking_services;
DROP POLICY IF EXISTS booking_services_update_own ON public.booking_services;
DROP POLICY IF EXISTS booking_services_delete_own ON public.booking_services;

CREATE POLICY booking_services_insert_own
ON public.booking_services
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_services.booking_id
      AND b.user_id = auth.uid()
      AND public.user_can_write_bookings(b.user_id)
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
      AND public.user_can_write_bookings(b.user_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_services.booking_id
      AND b.user_id = auth.uid()
      AND public.user_can_write_bookings(b.user_id)
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
      AND public.user_can_write_bookings(b.user_id)
  )
);

DROP POLICY IF EXISTS booking_freelance_insert_own ON public.booking_freelance;
DROP POLICY IF EXISTS booking_freelance_update_own ON public.booking_freelance;
DROP POLICY IF EXISTS booking_freelance_delete_own ON public.booking_freelance;

CREATE POLICY booking_freelance_insert_own
ON public.booking_freelance
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_freelance.booking_id
      AND b.user_id = auth.uid()
      AND public.user_can_write_bookings(b.user_id)
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
      AND public.user_can_write_bookings(b.user_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_freelance.booking_id
      AND b.user_id = auth.uid()
      AND public.user_can_write_bookings(b.user_id)
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
      AND public.user_can_write_bookings(b.user_id)
  )
);

COMMIT;
