-- Split Fastpik result-link display mode into per-surface settings

BEGIN;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS fastpik_link_display_mode_booking_detail text;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS fastpik_link_display_mode_tracking text;

UPDATE public.profiles
SET
  fastpik_link_display_mode_booking_detail = CASE
    WHEN fastpik_link_display_mode_booking_detail IN ('both', 'prefer_fastpik', 'drive_only')
      THEN fastpik_link_display_mode_booking_detail
    WHEN fastpik_link_display_mode IN ('both', 'prefer_fastpik', 'drive_only')
      THEN fastpik_link_display_mode
    ELSE 'prefer_fastpik'
  END,
  fastpik_link_display_mode_tracking = CASE
    WHEN fastpik_link_display_mode_tracking IN ('both', 'prefer_fastpik', 'drive_only')
      THEN fastpik_link_display_mode_tracking
    WHEN fastpik_link_display_mode IN ('both', 'prefer_fastpik', 'drive_only')
      THEN fastpik_link_display_mode
    ELSE 'prefer_fastpik'
  END;

ALTER TABLE public.profiles
ALTER COLUMN fastpik_link_display_mode_booking_detail SET DEFAULT 'prefer_fastpik';

ALTER TABLE public.profiles
ALTER COLUMN fastpik_link_display_mode_tracking SET DEFAULT 'prefer_fastpik';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND constraint_name = 'profiles_fastpik_link_display_mode_booking_detail_check'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_fastpik_link_display_mode_booking_detail_check
    CHECK (fastpik_link_display_mode_booking_detail IN ('both', 'prefer_fastpik', 'drive_only'));
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND constraint_name = 'profiles_fastpik_link_display_mode_tracking_check'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_fastpik_link_display_mode_tracking_check
    CHECK (fastpik_link_display_mode_tracking IN ('both', 'prefer_fastpik', 'drive_only'));
  END IF;
END;
$$;

COMMIT;
