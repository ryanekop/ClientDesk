-- ============================================================
-- Migration: Multi-session Google Calendar event IDs per booking
-- - add google_calendar_event_ids (jsonb map)
-- - backfill from legacy google_calendar_event_id
-- ============================================================

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS google_calendar_event_ids jsonb;

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
      SET google_calendar_event_ids = jsonb_build_object('primary', google_calendar_event_id)
      WHERE (google_calendar_event_ids IS NULL OR google_calendar_event_ids = '{}'::jsonb)
        AND COALESCE(NULLIF(btrim(google_calendar_event_id), ''), '') <> '';
    $sql$;
  END IF;
END $$;
