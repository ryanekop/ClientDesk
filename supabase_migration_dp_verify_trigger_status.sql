-- Migration: booking status trigger for automatic DP verification

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS dp_verify_trigger_status TEXT;

UPDATE public.profiles
SET dp_verify_trigger_status = NULL
WHERE COALESCE(TRIM(dp_verify_trigger_status), '') = '';
