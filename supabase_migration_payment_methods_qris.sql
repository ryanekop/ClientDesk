-- Payment methods, QRIS asset, and booking payment source snapshot

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS form_payment_methods text[] DEFAULT ARRAY['bank']::text[],
ADD COLUMN IF NOT EXISTS qris_image_url text,
ADD COLUMN IF NOT EXISTS qris_drive_file_id text;

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS payment_method text CHECK (payment_method IN ('bank', 'qris', 'cash')),
ADD COLUMN IF NOT EXISTS payment_source jsonb;

UPDATE public.profiles
SET form_payment_methods = ARRAY['bank']::text[]
WHERE form_payment_methods IS NULL OR array_length(form_payment_methods, 1) IS NULL;

UPDATE public.profiles
SET bank_accounts = COALESCE(
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',
        COALESCE(
          NULLIF(account ->> 'id', ''),
          replace(uuid_generate_v4()::text, '-', '')
        ),
        'bank_name',
        COALESCE(account ->> 'bank_name', ''),
        'account_number',
        COALESCE(account ->> 'account_number', ''),
        'account_name',
        COALESCE(account ->> 'account_name', ''),
        'enabled',
        CASE
          WHEN account ? 'enabled' AND lower(COALESCE(account ->> 'enabled', '')) IN ('true', 'false')
            THEN (account ->> 'enabled')::boolean
          ELSE true
        END
      )
    )
    FROM jsonb_array_elements(COALESCE(bank_accounts, '[]'::jsonb)) account
  ),
  '[]'::jsonb
);
