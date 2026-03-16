-- Add public/private visibility flag for services and addons.
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;

UPDATE public.services
SET is_public = COALESCE(is_public, true)
WHERE is_public IS NULL;

ALTER TABLE public.services
ALTER COLUMN is_public SET DEFAULT true,
ALTER COLUMN is_public SET NOT NULL;
