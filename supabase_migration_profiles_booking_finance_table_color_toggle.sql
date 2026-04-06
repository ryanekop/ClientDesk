-- Add independent toggles for package-based row coloring in booking list and finance list.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS booking_table_color_enabled BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS finance_table_color_enabled BOOLEAN NOT NULL DEFAULT FALSE;
