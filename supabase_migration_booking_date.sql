-- Booking date business field (editable), independent from created_at audit timestamp.

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS booking_date date;

UPDATE public.bookings
SET booking_date = COALESCE(booking_date, created_at::date, CURRENT_DATE)
WHERE booking_date IS NULL;

ALTER TABLE public.bookings
ALTER COLUMN booking_date SET DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS bookings_user_booking_date_idx
ON public.bookings (user_id, booking_date DESC, created_at DESC);
