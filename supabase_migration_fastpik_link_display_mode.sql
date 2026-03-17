-- Fastpik result-link display mode setting

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS fastpik_link_display_mode text DEFAULT 'prefer_fastpik';

UPDATE public.profiles
SET fastpik_link_display_mode = 'prefer_fastpik'
WHERE fastpik_link_display_mode IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND constraint_name = 'profiles_fastpik_link_display_mode_check'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_fastpik_link_display_mode_check
    CHECK (fastpik_link_display_mode IN ('both', 'prefer_fastpik', 'drive_only'));
  END IF;
END;
$$;
