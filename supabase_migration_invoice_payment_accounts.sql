-- Invoice PDF payment account visibility settings

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS invoice_payment_accounts_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS invoice_payment_bank_account_ids text[] DEFAULT ARRAY[]::text[];

UPDATE public.profiles
SET invoice_payment_accounts_enabled = false
WHERE invoice_payment_accounts_enabled IS NULL;

UPDATE public.profiles
SET invoice_payment_bank_account_ids = ARRAY[]::text[]
WHERE invoice_payment_bank_account_ids IS NULL;
