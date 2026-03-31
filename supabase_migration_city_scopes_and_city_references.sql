BEGIN;

CREATE TABLE IF NOT EXISTS public.region_city_references (
  city_code TEXT PRIMARY KEY,
  city_name TEXT NOT NULL,
  province_code TEXT NOT NULL,
  province_name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'cahyadsn/wilayah',
  source_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT region_city_references_city_code_format
    CHECK (city_code ~ '^[0-9]{4}$'),
  CONSTRAINT region_city_references_province_code_format
    CHECK (province_code ~ '^[0-9]{2}$'),
  CONSTRAINT region_city_references_city_name_not_blank
    CHECK (char_length(btrim(city_name)) > 0),
  CONSTRAINT region_city_references_province_name_not_blank
    CHECK (char_length(btrim(province_name)) > 0)
);

CREATE INDEX IF NOT EXISTS region_city_references_province_code_idx
  ON public.region_city_references (province_code);

CREATE INDEX IF NOT EXISTS region_city_references_city_name_idx
  ON public.region_city_references (city_name);

CREATE INDEX IF NOT EXISTS region_city_references_province_city_idx
  ON public.region_city_references (province_code, city_name);

CREATE OR REPLACE FUNCTION public.update_region_city_references_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS region_city_references_set_updated_at
  ON public.region_city_references;

CREATE TRIGGER region_city_references_set_updated_at
BEFORE UPDATE ON public.region_city_references
FOR EACH ROW
EXECUTE PROCEDURE public.update_region_city_references_updated_at();

ALTER TABLE public.region_city_references ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS region_city_references_select_authenticated
  ON public.region_city_references;

CREATE POLICY region_city_references_select_authenticated
ON public.region_city_references
FOR SELECT TO authenticated
USING (true);

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS city_code TEXT,
  ADD COLUMN IF NOT EXISTS city_name TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_city_code_fkey'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_city_code_fkey
      FOREIGN KEY (city_code)
      REFERENCES public.region_city_references(city_code)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_city_code_format_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_city_code_format_check
      CHECK (city_code IS NULL OR city_code ~ '^[0-9]{4}$');
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS bookings_user_city_code_idx
  ON public.bookings (user_id, city_code);

CREATE INDEX IF NOT EXISTS bookings_city_name_idx
  ON public.bookings (city_name);

CREATE TABLE IF NOT EXISTS public.service_city_scopes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  city_code TEXT NOT NULL REFERENCES public.region_city_references(city_code) ON UPDATE CASCADE ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'service_city_scopes_service_city_unique'
  ) THEN
    ALTER TABLE public.service_city_scopes
      ADD CONSTRAINT service_city_scopes_service_city_unique
      UNIQUE (service_id, city_code);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS service_city_scopes_user_service_idx
  ON public.service_city_scopes (user_id, service_id);

CREATE INDEX IF NOT EXISTS service_city_scopes_user_city_idx
  ON public.service_city_scopes (user_id, city_code);

CREATE INDEX IF NOT EXISTS service_city_scopes_service_idx
  ON public.service_city_scopes (service_id);

ALTER TABLE public.service_city_scopes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_city_scopes_select_own
  ON public.service_city_scopes;
DROP POLICY IF EXISTS service_city_scopes_insert_own
  ON public.service_city_scopes;
DROP POLICY IF EXISTS service_city_scopes_update_own
  ON public.service_city_scopes;
DROP POLICY IF EXISTS service_city_scopes_delete_own
  ON public.service_city_scopes;

CREATE POLICY service_city_scopes_select_own
ON public.service_city_scopes
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY service_city_scopes_insert_own
ON public.service_city_scopes
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.services s
    WHERE s.id = service_city_scopes.service_id
      AND s.user_id = auth.uid()
  )
);

CREATE POLICY service_city_scopes_update_own
ON public.service_city_scopes
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.services s
    WHERE s.id = service_city_scopes.service_id
      AND s.user_id = auth.uid()
  )
);

CREATE POLICY service_city_scopes_delete_own
ON public.service_city_scopes
FOR DELETE TO authenticated
USING (user_id = auth.uid());

COMMIT;
