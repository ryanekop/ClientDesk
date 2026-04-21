ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS project_deadline_date DATE;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS client_status_deadline_rules JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tracking_project_deadline_visible BOOLEAN NOT NULL DEFAULT false;

UPDATE public.profiles
SET client_status_deadline_rules = '{}'::jsonb
WHERE client_status_deadline_rules IS NULL;
