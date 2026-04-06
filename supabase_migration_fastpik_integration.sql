-- Fastpik integration fields

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS fastpik_integration_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS fastpik_sync_mode text DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS fastpik_preset_source text DEFAULT 'fastpik',
ADD COLUMN IF NOT EXISTS fastpik_api_key text,
ADD COLUMN IF NOT EXISTS fastpik_last_sync_at timestamptz,
ADD COLUMN IF NOT EXISTS fastpik_last_sync_status text DEFAULT 'idle',
ADD COLUMN IF NOT EXISTS fastpik_last_sync_message text,
ADD COLUMN IF NOT EXISTS fastpik_default_max_photos integer,
ADD COLUMN IF NOT EXISTS fastpik_default_selection_days integer,
ADD COLUMN IF NOT EXISTS fastpik_default_download_days integer,
ADD COLUMN IF NOT EXISTS fastpik_default_detect_subfolders boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS fastpik_default_password text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND constraint_name = 'profiles_fastpik_sync_mode_check'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_fastpik_sync_mode_check
    CHECK (fastpik_sync_mode IN ('manual', 'auto'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND constraint_name = 'profiles_fastpik_preset_source_check'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_fastpik_preset_source_check
    CHECK (fastpik_preset_source IN ('clientdesk', 'fastpik'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND constraint_name = 'profiles_fastpik_last_sync_status_check'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_fastpik_last_sync_status_check
    CHECK (fastpik_last_sync_status IN ('idle', 'success', 'warning', 'failed', 'syncing'));
  END IF;
END;
$$;

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS fastpik_project_id text,
ADD COLUMN IF NOT EXISTS fastpik_project_link text,
ADD COLUMN IF NOT EXISTS fastpik_sync_status text DEFAULT 'idle',
ADD COLUMN IF NOT EXISTS fastpik_last_synced_at timestamptz,
ADD COLUMN IF NOT EXISTS fastpik_sync_message text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND constraint_name = 'bookings_fastpik_sync_status_check'
  ) THEN
    ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_fastpik_sync_status_check
    CHECK (fastpik_sync_status IN ('idle', 'success', 'warning', 'failed', 'syncing'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS bookings_user_fastpik_sync_idx
ON public.bookings (user_id, fastpik_sync_status, created_at DESC);

CREATE INDEX IF NOT EXISTS bookings_user_drive_link_idx
ON public.bookings (user_id, drive_folder_url);

