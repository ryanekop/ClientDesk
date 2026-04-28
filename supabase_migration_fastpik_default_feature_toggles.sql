-- Fastpik ClientDesk preset feature toggles

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS fastpik_default_selection_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS fastpik_default_download_enabled boolean DEFAULT true;

UPDATE public.profiles
SET fastpik_default_selection_enabled = true
WHERE fastpik_default_selection_enabled IS NULL;

UPDATE public.profiles
SET fastpik_default_download_enabled = true
WHERE fastpik_default_download_enabled IS NULL;
