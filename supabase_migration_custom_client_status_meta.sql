ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS custom_client_status_meta JSONB NOT NULL DEFAULT '{}'::jsonb;
