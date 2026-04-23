BEGIN;

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_fastpik_link_display_mode_tracking_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_fastpik_link_display_mode_tracking_check
CHECK (
  fastpik_link_display_mode_tracking IN (
    'both',
    'prefer_fastpik',
    'drive_only',
    'fastpik_with_video_only'
  )
);

COMMIT;
