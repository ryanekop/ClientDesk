-- Persist connected Google account emails for Calendar and Drive integrations
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS google_calendar_account_email TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS google_drive_account_email TEXT;
