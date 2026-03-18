-- ========================================================
-- Client Desk - Multi-Tenant (Fastpik parity)
-- ========================================================

BEGIN;

-- =============================================
-- TABLE: tenants
-- =============================================
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  domain TEXT UNIQUE,
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT DEFAULT '#7c3aed',
  footer_text TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default tenant = Client Desk
INSERT INTO public.tenants (slug, name, domain, logo_url, primary_color, footer_text)
VALUES (
  'clientdesk',
  'Client Desk',
  'clientdesk.ryanekoapp.web.id',
  '/icon-192.png',
  '#7c3aed',
  NULL
)
ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- Link profiles -> tenants
-- =============================================
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- Assign all existing profiles to default tenant
UPDATE public.profiles
SET tenant_id = (SELECT id FROM public.tenants WHERE slug = 'clientdesk')
WHERE tenant_id IS NULL;

-- =============================================
-- Indexes
-- =============================================
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON public.tenants(domain);
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants(slug);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON public.profiles(tenant_id);

-- =============================================
-- RLS for tenants table
-- =============================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active tenants" ON public.tenants;
CREATE POLICY "Public can read active tenants" ON public.tenants
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Service role full access tenants" ON public.tenants;
CREATE POLICY "Service role full access tenants" ON public.tenants
  FOR ALL USING (true);

-- =============================================
-- Auto-update updated_at
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_tenants_updated_at ON public.tenants;
CREATE TRIGGER update_tenants_updated_at
BEFORE UPDATE ON public.tenants
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

COMMIT;
