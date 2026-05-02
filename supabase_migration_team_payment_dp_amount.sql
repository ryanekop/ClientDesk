-- Add manual DP tracking for team/freelance payment entries.
ALTER TABLE public.freelance_payment_entries
ADD COLUMN IF NOT EXISTS dp_amount NUMERIC(15, 2) NOT NULL DEFAULT 0;
