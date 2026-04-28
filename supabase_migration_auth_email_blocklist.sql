-- Block specific emails from ClientDesk signup and suspend existing accounts.

CREATE TABLE IF NOT EXISTS public.auth_email_blocklist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  reason TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  suspended_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_email_blocklist_email_lowercase CHECK (email = lower(trim(email))),
  CONSTRAINT auth_email_blocklist_email_unique UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_auth_email_blocklist_active_email
  ON public.auth_email_blocklist (email)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_auth_email_blocklist_suspended_user_id
  ON public.auth_email_blocklist (suspended_user_id)
  WHERE is_active = TRUE AND suspended_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_auth_email_blocklist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auth_email_blocklist_updated_at
  ON public.auth_email_blocklist;

CREATE TRIGGER trg_auth_email_blocklist_updated_at
  BEFORE UPDATE ON public.auth_email_blocklist
  FOR EACH ROW
  EXECUTE FUNCTION public.set_auth_email_blocklist_updated_at();

ALTER TABLE public.auth_email_blocklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages auth email blocklist"
  ON public.auth_email_blocklist;

CREATE POLICY "Service role manages auth email blocklist"
  ON public.auth_email_blocklist
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
