-- ========================================================
-- Migration: Team Pricelist + Form Multiple Toggles
-- ========================================================

-- 1) Pricelist matrix per team/freelance member
DO $$
BEGIN
  IF to_regclass('public.freelance') IS NOT NULL THEN
    EXECUTE '
      ALTER TABLE public.freelance
      ADD COLUMN IF NOT EXISTS pricelist jsonb
      DEFAULT ''{"columns":[],"items":[]}''::jsonb
    ';

    EXECUTE '
      UPDATE public.freelance
      SET pricelist = ''{"columns":[],"items":[]}''::jsonb
      WHERE pricelist IS NULL
    ';
  ELSIF to_regclass('public.freelancers') IS NOT NULL THEN
    EXECUTE '
      ALTER TABLE public.freelancers
      ADD COLUMN IF NOT EXISTS pricelist jsonb
      DEFAULT ''{"columns":[],"items":[]}''::jsonb
    ';

    EXECUTE '
      UPDATE public.freelancers
      SET pricelist = ''{"columns":[],"items":[]}''::jsonb
      WHERE pricelist IS NULL
    ';
  END IF;
END $$;

-- 2) Public booking form toggles for package/add-on multi-select behavior
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS form_allow_multiple_packages boolean DEFAULT true;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS form_allow_multiple_addons boolean DEFAULT true;

UPDATE public.profiles
SET form_allow_multiple_packages = true
WHERE form_allow_multiple_packages IS NULL;

UPDATE public.profiles
SET form_allow_multiple_addons = true
WHERE form_allow_multiple_addons IS NULL;
