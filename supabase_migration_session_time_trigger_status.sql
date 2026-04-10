-- Trigger otomatis status klien saat jam sesi tiba.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS session_time_trigger_from_status TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS session_time_trigger_to_status TEXT;

UPDATE public.profiles
SET session_time_trigger_from_status = NULL
WHERE COALESCE(TRIM(session_time_trigger_from_status), '') = '';

UPDATE public.profiles
SET session_time_trigger_to_status = NULL
WHERE COALESCE(TRIM(session_time_trigger_to_status), '') = '';
