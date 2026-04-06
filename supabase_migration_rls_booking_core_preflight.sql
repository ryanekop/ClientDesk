-- ========================================================
-- Preflight Check: RLS Booking Core Tables
-- Read-only checks before running supabase_migration_rls_booking_core.sql
-- ========================================================

-- 1) Null owner checks
SELECT 'bookings.user_id IS NULL' AS check_name, COUNT(*) AS issue_count
FROM public.bookings
WHERE user_id IS NULL;

SELECT 'services.user_id IS NULL' AS check_name, COUNT(*) AS issue_count
FROM public.services
WHERE user_id IS NULL;

SELECT 'freelance.user_id IS NULL' AS check_name, COUNT(*) AS issue_count
FROM public.freelance
WHERE user_id IS NULL;

-- 2) Orphan junction rows
SELECT 'booking_services orphan booking/service' AS check_name, COUNT(*) AS issue_count
FROM public.booking_services bs
LEFT JOIN public.bookings b ON b.id = bs.booking_id
LEFT JOIN public.services s ON s.id = bs.service_id
WHERE b.id IS NULL OR s.id IS NULL;

SELECT 'booking_freelance orphan booking/freelance' AS check_name, COUNT(*) AS issue_count
FROM public.booking_freelance bf
LEFT JOIN public.bookings b ON b.id = bf.booking_id
LEFT JOIN public.freelance f ON f.id = bf.freelance_id
WHERE b.id IS NULL OR f.id IS NULL;

-- 3) Ownership mismatch in junction rows
SELECT 'booking_services owner mismatch' AS check_name, COUNT(*) AS issue_count
FROM public.booking_services bs
JOIN public.bookings b ON b.id = bs.booking_id
JOIN public.services s ON s.id = bs.service_id
WHERE b.user_id IS DISTINCT FROM s.user_id;

SELECT 'booking_freelance owner mismatch' AS check_name, COUNT(*) AS issue_count
FROM public.booking_freelance bf
JOIN public.bookings b ON b.id = bf.booking_id
JOIN public.freelance f ON f.id = bf.freelance_id
WHERE b.user_id IS DISTINCT FROM f.user_id;

-- Optional details (keep LIMIT small for manual review)
SELECT bs.id, bs.booking_id, bs.service_id, b.user_id AS booking_owner, s.user_id AS service_owner
FROM public.booking_services bs
JOIN public.bookings b ON b.id = bs.booking_id
JOIN public.services s ON s.id = bs.service_id
WHERE b.user_id IS DISTINCT FROM s.user_id
ORDER BY bs.created_at DESC
LIMIT 50;

SELECT bf.id, bf.booking_id, bf.freelance_id, b.user_id AS booking_owner, f.user_id AS freelance_owner
FROM public.booking_freelance bf
JOIN public.bookings b ON b.id = bf.booking_id
JOIN public.freelance f ON f.id = bf.freelance_id
WHERE b.user_id IS DISTINCT FROM f.user_id
ORDER BY bf.created_at DESC
LIMIT 50;
