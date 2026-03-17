-- ============================================================
-- MIGRATION: Unifikasi event type Lainnya -> Custom/Lainnya
-- Tujuan:
-- 1) Menjadikan satu event type khusus canonical: Custom/Lainnya
-- 2) Migrasi data lama Lainnya di bookings/templates/services/profiles
-- 3) Rename key JSONB profile map dari Lainnya ke Custom/Lainnya
-- Idempotent: aman dijalankan berulang
-- ============================================================

-- --- BOOKINGS -------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND column_name = 'event_type'
  ) THEN
    UPDATE public.bookings
    SET event_type = 'Custom/Lainnya'
    WHERE event_type IS NOT NULL
      AND btrim(event_type) = 'Lainnya';
  END IF;
END $$;

-- --- TEMPLATES ------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'templates'
      AND column_name = 'event_type'
  ) THEN
    UPDATE public.templates
    SET event_type = 'Custom/Lainnya'
    WHERE event_type IS NOT NULL
      AND btrim(event_type) = 'Lainnya';
  END IF;
END $$;

-- --- SERVICES.event_types (array replace + dedupe by order) ---
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'services'
      AND column_name = 'event_types'
  ) THEN
    UPDATE public.services AS s
    SET event_types = normalized.event_types
    FROM LATERAL (
      SELECT
        CASE
          WHEN COUNT(*) = 0 THEN NULL::text[]
          ELSE array_agg(item ORDER BY first_ord)
        END AS event_types
      FROM (
        SELECT item, MIN(ord) AS first_ord
        FROM (
          SELECT
            CASE
              WHEN btrim(value) = 'Lainnya' THEN 'Custom/Lainnya'
              ELSE btrim(value)
            END AS item,
            ord
          FROM unnest(COALESCE(s.event_types, ARRAY[]::text[])) WITH ORDINALITY AS t(value, ord)
          WHERE value IS NOT NULL
            AND btrim(value) <> ''
        ) normalized_items
        GROUP BY item
      ) deduped
    ) AS normalized
    WHERE s.event_types IS DISTINCT FROM normalized.event_types;
  END IF;
END $$;

-- --- PROFILES.form_event_types (array replace + dedupe) -------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'form_event_types'
  ) THEN
    UPDATE public.profiles AS p
    SET form_event_types =
      CASE
        WHEN normalized.form_event_types IS NULL THEN NULL
        WHEN 'Custom/Lainnya' = ANY(normalized.form_event_types) THEN normalized.form_event_types
        ELSE normalized.form_event_types || ARRAY['Custom/Lainnya']::text[]
      END
    FROM LATERAL (
      SELECT
        CASE
          WHEN COUNT(*) = 0 THEN NULL::text[]
          ELSE array_agg(item ORDER BY first_ord)
        END AS form_event_types
      FROM (
        SELECT item, MIN(ord) AS first_ord
        FROM (
          SELECT
            CASE
              WHEN btrim(value) = 'Lainnya' THEN 'Custom/Lainnya'
              ELSE btrim(value)
            END AS item,
            ord
          FROM unnest(COALESCE(p.form_event_types, ARRAY[]::text[])) WITH ORDINALITY AS t(value, ord)
          WHERE value IS NOT NULL
            AND btrim(value) <> ''
        ) normalized_items
        GROUP BY item
      ) deduped
    ) AS normalized
    WHERE p.form_event_types IS DISTINCT FROM (
      CASE
        WHEN normalized.form_event_types IS NULL THEN NULL
        WHEN 'Custom/Lainnya' = ANY(normalized.form_event_types) THEN normalized.form_event_types
        ELSE normalized.form_event_types || ARRAY['Custom/Lainnya']::text[]
      END
    );
  END IF;
END $$;

-- --- PROFILES.custom_event_types (array replace + dedupe) -----
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'custom_event_types'
  ) THEN
    UPDATE public.profiles AS p
    SET custom_event_types = normalized.custom_event_types
    FROM LATERAL (
      SELECT
        CASE
          WHEN COUNT(*) = 0 THEN ARRAY[]::text[]
          ELSE array_agg(item ORDER BY first_ord)
        END AS custom_event_types
      FROM (
        SELECT item, MIN(ord) AS first_ord
        FROM (
          SELECT
            CASE
              WHEN btrim(value) = 'Lainnya' THEN 'Custom/Lainnya'
              ELSE btrim(value)
            END AS item,
            ord
          FROM unnest(COALESCE(p.custom_event_types, ARRAY[]::text[])) WITH ORDINALITY AS t(value, ord)
          WHERE value IS NOT NULL
            AND btrim(value) <> ''
        ) normalized_items
        GROUP BY item
      ) deduped
    ) AS normalized
    WHERE p.custom_event_types IS DISTINCT FROM normalized.custom_event_types;
  END IF;
END $$;

-- --- PROFILES JSONB key rename helpers -------------------------
-- Rule:
-- - Jika ada key "Lainnya" dan belum ada "Custom/Lainnya": pindahkan nilai ke key baru
-- - Jika keduanya ada: pertahankan "Custom/Lainnya" lalu hapus key "Lainnya"

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'min_dp_map'
  ) THEN
    UPDATE public.profiles
    SET min_dp_map = CASE
      WHEN min_dp_map IS NULL OR jsonb_typeof(min_dp_map) <> 'object' THEN min_dp_map
      WHEN min_dp_map ? 'Lainnya' AND NOT (min_dp_map ? 'Custom/Lainnya')
        THEN (min_dp_map - 'Lainnya') || jsonb_build_object('Custom/Lainnya', min_dp_map -> 'Lainnya')
      WHEN min_dp_map ? 'Lainnya' AND (min_dp_map ? 'Custom/Lainnya')
        THEN min_dp_map - 'Lainnya'
      ELSE min_dp_map
    END
    WHERE min_dp_map IS NOT NULL
      AND jsonb_typeof(min_dp_map) = 'object'
      AND min_dp_map ? 'Lainnya';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'form_sections'
  ) THEN
    UPDATE public.profiles
    SET form_sections = CASE
      WHEN form_sections IS NULL OR jsonb_typeof(form_sections) <> 'object' THEN form_sections
      WHEN form_sections ? 'Lainnya' AND NOT (form_sections ? 'Custom/Lainnya')
        THEN (form_sections - 'Lainnya') || jsonb_build_object('Custom/Lainnya', form_sections -> 'Lainnya')
      WHEN form_sections ? 'Lainnya' AND (form_sections ? 'Custom/Lainnya')
        THEN form_sections - 'Lainnya'
      ELSE form_sections
    END
    WHERE form_sections IS NOT NULL
      AND jsonb_typeof(form_sections) = 'object'
      AND form_sections ? 'Lainnya';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'calendar_event_format_map'
  ) THEN
    UPDATE public.profiles
    SET calendar_event_format_map = CASE
      WHEN calendar_event_format_map IS NULL OR jsonb_typeof(calendar_event_format_map) <> 'object' THEN calendar_event_format_map
      WHEN calendar_event_format_map ? 'Lainnya' AND NOT (calendar_event_format_map ? 'Custom/Lainnya')
        THEN (calendar_event_format_map - 'Lainnya') || jsonb_build_object('Custom/Lainnya', calendar_event_format_map -> 'Lainnya')
      WHEN calendar_event_format_map ? 'Lainnya' AND (calendar_event_format_map ? 'Custom/Lainnya')
        THEN calendar_event_format_map - 'Lainnya'
      ELSE calendar_event_format_map
    END
    WHERE calendar_event_format_map IS NOT NULL
      AND jsonb_typeof(calendar_event_format_map) = 'object'
      AND calendar_event_format_map ? 'Lainnya';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'calendar_event_description_map'
  ) THEN
    UPDATE public.profiles
    SET calendar_event_description_map = CASE
      WHEN calendar_event_description_map IS NULL OR jsonb_typeof(calendar_event_description_map) <> 'object' THEN calendar_event_description_map
      WHEN calendar_event_description_map ? 'Lainnya' AND NOT (calendar_event_description_map ? 'Custom/Lainnya')
        THEN (calendar_event_description_map - 'Lainnya') || jsonb_build_object('Custom/Lainnya', calendar_event_description_map -> 'Lainnya')
      WHEN calendar_event_description_map ? 'Lainnya' AND (calendar_event_description_map ? 'Custom/Lainnya')
        THEN calendar_event_description_map - 'Lainnya'
      ELSE calendar_event_description_map
    END
    WHERE calendar_event_description_map IS NOT NULL
      AND jsonb_typeof(calendar_event_description_map) = 'object'
      AND calendar_event_description_map ? 'Lainnya';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'drive_folder_format_map'
  ) THEN
    UPDATE public.profiles
    SET drive_folder_format_map = CASE
      WHEN drive_folder_format_map IS NULL OR jsonb_typeof(drive_folder_format_map) <> 'object' THEN drive_folder_format_map
      WHEN drive_folder_format_map ? 'Lainnya' AND NOT (drive_folder_format_map ? 'Custom/Lainnya')
        THEN (drive_folder_format_map - 'Lainnya') || jsonb_build_object('Custom/Lainnya', drive_folder_format_map -> 'Lainnya')
      WHEN drive_folder_format_map ? 'Lainnya' AND (drive_folder_format_map ? 'Custom/Lainnya')
        THEN drive_folder_format_map - 'Lainnya'
      ELSE drive_folder_format_map
    END
    WHERE drive_folder_format_map IS NOT NULL
      AND jsonb_typeof(drive_folder_format_map) = 'object'
      AND drive_folder_format_map ? 'Lainnya';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'drive_folder_structure_map'
  ) THEN
    UPDATE public.profiles
    SET drive_folder_structure_map = CASE
      WHEN drive_folder_structure_map IS NULL OR jsonb_typeof(drive_folder_structure_map) <> 'object' THEN drive_folder_structure_map
      WHEN drive_folder_structure_map ? 'Lainnya' AND NOT (drive_folder_structure_map ? 'Custom/Lainnya')
        THEN (drive_folder_structure_map - 'Lainnya') || jsonb_build_object('Custom/Lainnya', drive_folder_structure_map -> 'Lainnya')
      WHEN drive_folder_structure_map ? 'Lainnya' AND (drive_folder_structure_map ? 'Custom/Lainnya')
        THEN drive_folder_structure_map - 'Lainnya'
      ELSE drive_folder_structure_map
    END
    WHERE drive_folder_structure_map IS NOT NULL
      AND jsonb_typeof(drive_folder_structure_map) = 'object'
      AND drive_folder_structure_map ? 'Lainnya';
  END IF;
END $$;
