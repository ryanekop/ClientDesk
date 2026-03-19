-- Keep booking_date as the primary business date by deriving missing values
-- from created_at at write time.

-- Backfill existing rows that still have no booking_date.
UPDATE public.bookings
SET booking_date = COALESCE(booking_date, created_at::date, NOW()::date)
WHERE booking_date IS NULL;

-- Do not rely on CURRENT_DATE default anymore; use trigger-based sync instead.
ALTER TABLE public.bookings
ALTER COLUMN booking_date DROP DEFAULT;

-- Fill booking_date from created_at when booking_date is omitted/null.
CREATE OR REPLACE FUNCTION public.set_booking_date_from_created_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.booking_date := COALESCE(
    NEW.booking_date,
    COALESCE(NEW.created_at, NOW())::date
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_set_booking_date ON public.bookings;
CREATE TRIGGER bookings_set_booking_date
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.set_booking_date_from_created_at();
