-- ============================================================
-- MIGRATION: Ensure calendar description columns exist
-- Run this SQL in Supabase SQL Editor
-- ============================================================

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
