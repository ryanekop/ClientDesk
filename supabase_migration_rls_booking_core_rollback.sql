-- ========================================================
-- Rollback: Disable RLS for booking core tables
-- Scope: bookings, services, freelance, booking_services, booking_freelance
-- ========================================================

BEGIN;

DROP POLICY IF EXISTS bookings_select_own ON public.bookings;
DROP POLICY IF EXISTS bookings_insert_own ON public.bookings;
DROP POLICY IF EXISTS bookings_update_own ON public.bookings;
DROP POLICY IF EXISTS bookings_delete_own ON public.bookings;

DROP POLICY IF EXISTS services_select_own ON public.services;
DROP POLICY IF EXISTS services_insert_own ON public.services;
DROP POLICY IF EXISTS services_update_own ON public.services;
DROP POLICY IF EXISTS services_delete_own ON public.services;

DROP POLICY IF EXISTS freelance_select_own ON public.freelance;
DROP POLICY IF EXISTS freelance_insert_own ON public.freelance;
DROP POLICY IF EXISTS freelance_update_own ON public.freelance;
DROP POLICY IF EXISTS freelance_delete_own ON public.freelance;

DROP POLICY IF EXISTS booking_services_select_own ON public.booking_services;
DROP POLICY IF EXISTS booking_services_insert_own ON public.booking_services;
DROP POLICY IF EXISTS booking_services_update_own ON public.booking_services;
DROP POLICY IF EXISTS booking_services_delete_own ON public.booking_services;

DROP POLICY IF EXISTS booking_freelance_select_own ON public.booking_freelance;
DROP POLICY IF EXISTS booking_freelance_insert_own ON public.booking_freelance;
DROP POLICY IF EXISTS booking_freelance_update_own ON public.booking_freelance;
DROP POLICY IF EXISTS booking_freelance_delete_own ON public.booking_freelance;

ALTER TABLE public.bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.services DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.freelance DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_services DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_freelance DISABLE ROW LEVEL SECURITY;

COMMIT;
