-- ============================================================
-- Migration: Unify Booking Status with Client Progress
-- - custom_client_statuses becomes source of truth
-- - custom_statuses mirrors custom_client_statuses for compatibility
-- - bookings.status and bookings.client_status are synchronized
-- ============================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS custom_client_statuses jsonb;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS custom_statuses jsonb;

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS client_status text;

WITH normalized_profiles AS (
  SELECT
    id,
    COALESCE(
      CASE
        WHEN jsonb_typeof(custom_client_statuses) = 'array' AND jsonb_array_length(custom_client_statuses) > 0
          THEN custom_client_statuses
      END,
      CASE
        WHEN jsonb_typeof(custom_statuses) = 'array' AND jsonb_array_length(custom_statuses) > 0
          THEN custom_statuses
      END,
      '["Booking Confirmed","Sesi Foto / Acara","Antrian Edit","Proses Edit","Revisi","File Siap","Selesai"]'::jsonb
    ) AS statuses
  FROM public.profiles
),
normalized_progress AS (
  SELECT
    id,
    CASE
      WHEN jsonb_array_length(filtered_statuses) > 0 THEN filtered_statuses
      ELSE '["Booking Confirmed","Sesi Foto / Acara","Antrian Edit","Proses Edit","Revisi","File Siap","Selesai"]'::jsonb
    END AS progress_statuses
  FROM (
    SELECT
      id,
      COALESCE(
        jsonb_agg(status_item) FILTER (WHERE lower(btrim(status_item #>> '{}')) <> 'batal'),
        '[]'::jsonb
      ) AS filtered_statuses
    FROM normalized_profiles,
      LATERAL jsonb_array_elements(statuses) AS status_item
    GROUP BY id
  ) prepared
)
UPDATE public.profiles p
SET
  custom_client_statuses = np.progress_statuses,
  custom_statuses = np.progress_statuses
FROM normalized_progress np
WHERE p.id = np.id
  AND (
    p.custom_client_statuses IS DISTINCT FROM np.progress_statuses
    OR p.custom_statuses IS DISTINCT FROM np.progress_statuses
  );

WITH profile_progress AS (
  SELECT
    p.id AS user_id,
    ARRAY(
      SELECT jsonb_array_elements_text(p.custom_client_statuses)
    ) AS statuses
  FROM public.profiles p
),
resolved_booking_status AS (
  SELECT
    b.id,
    CASE
      WHEN lower(btrim(COALESCE(b.status, ''))) = 'batal'
        OR lower(btrim(COALESCE(b.client_status, ''))) = 'batal'
        THEN 'Batal'
      WHEN btrim(COALESCE(b.client_status, '')) <> ''
        AND btrim(b.client_status) = ANY (COALESCE(pp.statuses, ARRAY['Booking Confirmed']))
        THEN btrim(b.client_status)
      WHEN btrim(COALESCE(b.status, '')) <> ''
        AND btrim(b.status) = ANY (COALESCE(pp.statuses, ARRAY['Booking Confirmed']))
        THEN btrim(b.status)
      ELSE COALESCE(pp.statuses[1], 'Booking Confirmed')
    END AS synced_status
  FROM public.bookings b
  LEFT JOIN profile_progress pp ON pp.user_id = b.user_id
)
UPDATE public.bookings b
SET
  status = r.synced_status,
  client_status = r.synced_status,
  updated_at = NOW()
FROM resolved_booking_status r
WHERE b.id = r.id
  AND (
    b.status IS DISTINCT FROM r.synced_status
    OR b.client_status IS DISTINCT FROM r.synced_status
  );
