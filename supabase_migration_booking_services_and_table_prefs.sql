-- Booking service relations, table column preferences, and nested Drive folder structure.

CREATE TABLE IF NOT EXISTS public.booking_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'main' CHECK (kind IN ('main', 'addon')),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (booking_id, service_id, kind)
);

CREATE INDEX IF NOT EXISTS booking_services_booking_id_idx
  ON public.booking_services (booking_id, sort_order, created_at);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS drive_folder_structure_map JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS table_column_preferences JSONB DEFAULT '{}'::jsonb;

WITH legacy_rows AS (
  SELECT
    b.id AS booking_id,
    b.service_id,
    0 AS sort_order
  FROM public.bookings b
  WHERE b.service_id IS NOT NULL
)
INSERT INTO public.booking_services (booking_id, service_id, kind, sort_order)
SELECT booking_id, service_id, 'main', sort_order
FROM legacy_rows
ON CONFLICT (booking_id, service_id, kind) DO NOTHING;

WITH addon_rows AS (
  SELECT
    b.id AS booking_id,
    value AS service_id,
    ROW_NUMBER() OVER (PARTITION BY b.id ORDER BY value) - 1 AS sort_order
  FROM public.bookings b
  CROSS JOIN LATERAL jsonb_array_elements_text(
    COALESCE(b.extra_fields -> 'addon_ids', '[]'::jsonb)
  ) AS value
)
INSERT INTO public.booking_services (booking_id, service_id, kind, sort_order)
SELECT booking_id, service_id::uuid, 'addon', sort_order
FROM addon_rows
WHERE service_id ~* '^[0-9a-f-]{36}$'
ON CONFLICT (booking_id, service_id, kind) DO NOTHING;

UPDATE public.profiles
SET drive_folder_structure_map = jsonb_build_object(
  'Umum',
  jsonb_build_array(
    '{client_name}'
  )
)
WHERE drive_folder_structure_map IS NULL
   OR drive_folder_structure_map = '{}'::jsonb;
