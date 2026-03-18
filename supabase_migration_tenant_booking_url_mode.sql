-- ========================================================
-- Client Desk - Tenant Booking URL Mode
-- ========================================================

BEGIN;

ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS disable_booking_slug BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS default_booking_vendor_slug TEXT;

CREATE INDEX IF NOT EXISTS idx_tenants_default_booking_vendor_slug
ON public.tenants(default_booking_vendor_slug);

COMMIT;
