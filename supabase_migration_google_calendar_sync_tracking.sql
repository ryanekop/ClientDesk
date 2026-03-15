-- ============================================================
-- MIGRATION: Google Calendar sync tracking + backward-safe calendar columns
-- Run this SQL in Supabase SQL Editor
-- ============================================================

-- Keep previous calendar description columns available.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS calendar_event_description text;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS calendar_event_description_map jsonb;

UPDATE public.profiles
SET calendar_event_description = COALESCE(
  calendar_event_description,
  'Klien: {{client_name}}' || E'\n' ||
  'Booking: {{booking_code}}' || E'\n' ||
  'Paket: {{service_name}}' || E'\n' ||
  'Tanggal: {{session_date}}' || E'\n' ||
  'Jam: {{session_time}} - {{end_time}}' || E'\n' ||
  'Lokasi: {{location}}'
)
WHERE calendar_event_description IS NULL;

UPDATE public.profiles
SET calendar_event_description_map = COALESCE(
  calendar_event_description_map,
  jsonb_build_object(
    'Umum',
    COALESCE(
      calendar_event_description,
      'Klien: {{client_name}}' || E'\n' ||
      'Booking: {{booking_code}}' || E'\n' ||
      'Paket: {{service_name}}' || E'\n' ||
      'Tanggal: {{session_date}}' || E'\n' ||
      'Jam: {{session_time}} - {{end_time}}' || E'\n' ||
      'Lokasi: {{location}}'
    )
  )
)
WHERE calendar_event_description_map IS NULL;

-- Add booking sync tracking columns.
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS google_calendar_event_id text;

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS google_calendar_event_ids jsonb;

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS google_calendar_sync_status text;

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS google_calendar_sync_error text;

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS google_calendar_last_synced_at timestamptz;

-- Normalize existing rows.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND column_name = 'google_calendar_event_id'
  ) THEN
    EXECUTE $sql$
      UPDATE public.bookings
      SET google_calendar_event_ids = COALESCE(
        google_calendar_event_ids,
        jsonb_build_object('primary', google_calendar_event_id)
      )
      WHERE COALESCE(NULLIF(btrim(google_calendar_event_id), ''), '') <> '';
    $sql$;
  END IF;
END $$;

UPDATE public.bookings
SET google_calendar_sync_status = 'pending'
WHERE google_calendar_sync_status IS NULL;

UPDATE public.bookings
SET google_calendar_sync_status = 'success'
WHERE google_calendar_sync_status = 'pending'
  AND google_calendar_event_ids IS NOT NULL
  AND google_calendar_event_ids <> '{}'::jsonb;

ALTER TABLE public.bookings
ALTER COLUMN google_calendar_sync_status SET DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_google_calendar_sync_status_check'
  ) THEN
    ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_google_calendar_sync_status_check
    CHECK (google_calendar_sync_status IN ('pending', 'success', 'failed', 'skipped'));
  END IF;
END;
$$;
