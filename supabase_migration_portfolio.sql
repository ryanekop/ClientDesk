-- Add portfolio_url column to bookings table
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS portfolio_url text;
