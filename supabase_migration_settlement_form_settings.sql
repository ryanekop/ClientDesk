ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS settlement_form_brand_color TEXT DEFAULT '#10b981',
ADD COLUMN IF NOT EXISTS settlement_form_greeting TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS settlement_form_payment_methods JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS settlement_form_lang TEXT DEFAULT 'id';
