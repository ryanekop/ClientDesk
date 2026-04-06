-- ============================================================
-- Migration: Google Calendar / Drive Template Maps per Event Type
-- Run this in Supabase SQL Editor
-- ============================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS calendar_event_format_map jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS drive_folder_format_map jsonb DEFAULT '{}'::jsonb;

UPDATE public.profiles
SET calendar_event_format_map = jsonb_build_object(
    'Umum',
    COALESCE(calendar_event_format, '📸 {{client_name}} — {{service_name}}')
)
WHERE calendar_event_format_map IS NULL
   OR calendar_event_format_map = '{}'::jsonb;

UPDATE public.profiles
SET drive_folder_format_map = jsonb_build_object(
    'Umum',
    COALESCE(drive_folder_format, '{client_name}')
)
WHERE drive_folder_format_map IS NULL
   OR drive_folder_format_map = '{}'::jsonb;
