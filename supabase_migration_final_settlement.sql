ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS settlement_status TEXT DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS final_adjustments JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS final_payment_proof_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS final_payment_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS final_payment_method TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS final_payment_source JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS final_paid_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS final_invoice_sent_at TIMESTAMPTZ DEFAULT NULL;

UPDATE public.bookings
SET settlement_status = 'draft'
WHERE settlement_status IS NULL;

ALTER TABLE public.bookings
ALTER COLUMN settlement_status SET DEFAULT 'draft';
