ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS external_import_id text;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_user_external_import_id_unique
ON public.bookings (user_id, external_import_id)
WHERE external_import_id IS NOT NULL;
