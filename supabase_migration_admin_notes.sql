ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS admin_notes TEXT;
