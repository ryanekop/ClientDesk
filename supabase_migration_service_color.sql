-- Add per-service color for package/add-on UI highlighting.
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS color TEXT;

-- Backfill existing rows from form brand color when available.
UPDATE public.services AS service
SET color = upper(profile.form_brand_color)
FROM public.profiles AS profile
WHERE profile.id = service.user_id
  AND profile.form_brand_color ~* '^#[0-9a-f]{6}$'
  AND (
    service.color IS NULL
    OR btrim(service.color) = ''
    OR service.color !~* '^#[0-9a-f]{6}$'
  );

-- Ensure every row has a valid fallback color.
UPDATE public.services
SET color = '#000000'
WHERE color IS NULL
  OR btrim(color) = ''
  OR color !~* '^#[0-9a-f]{6}$';

-- Normalize stored value.
UPDATE public.services
SET color = upper(color)
WHERE color ~* '^#[0-9a-f]{6}$'
  AND color <> upper(color);

ALTER TABLE public.services
ALTER COLUMN color SET DEFAULT '#000000',
ALTER COLUMN color SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'services_color_hex_check'
      AND conrelid = 'public.services'::regclass
  ) THEN
    ALTER TABLE public.services
    ADD CONSTRAINT services_color_hex_check
    CHECK (color ~* '^#[0-9a-f]{6}$');
  END IF;
END $$;
