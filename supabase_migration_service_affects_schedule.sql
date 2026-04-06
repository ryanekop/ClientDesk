-- Add schedule impact flag for services/add-ons.
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS affects_schedule BOOLEAN DEFAULT true;

UPDATE public.services
SET affects_schedule = COALESCE(affects_schedule, true)
WHERE affects_schedule IS NULL;

ALTER TABLE public.services
ALTER COLUMN affects_schedule SET DEFAULT true,
ALTER COLUMN affects_schedule SET NOT NULL;
