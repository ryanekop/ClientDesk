-- ============================================================
-- Migration: Special Booking Event Type Lock + Tracking File Link Visibility
-- ============================================================

BEGIN;

ALTER TABLE public.booking_special_links
  ADD COLUMN IF NOT EXISTS event_type_locked BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.booking_special_links
  ADD COLUMN IF NOT EXISTS event_types TEXT[] NOT NULL DEFAULT '{}';

UPDATE public.booking_special_links
SET event_types = '{}'
WHERE event_types IS NULL;

ALTER TABLE public.booking_special_links
  ALTER COLUMN event_types SET DEFAULT '{}';

ALTER TABLE public.booking_special_links
  ALTER COLUMN event_types SET NOT NULL;

ALTER TABLE public.booking_special_links
  DROP CONSTRAINT IF EXISTS booking_special_links_event_type_locked_requires_event_types;

ALTER TABLE public.booking_special_links
  ADD CONSTRAINT booking_special_links_event_type_locked_requires_event_types
  CHECK (
    event_type_locked = false
    OR COALESCE(array_length(event_types, 1), 0) > 0
  );

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tracking_file_links_visible_from_status TEXT;

COMMIT;
