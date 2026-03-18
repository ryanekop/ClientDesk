-- ============================================================
-- Migration: Special Booking Links (Offer Token)
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.booking_special_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  package_locked BOOLEAN NOT NULL DEFAULT false,
  package_service_ids UUID[] NOT NULL DEFAULT '{}',
  addon_locked BOOLEAN NOT NULL DEFAULT false,
  addon_service_ids UUID[] NOT NULL DEFAULT '{}',
  accommodation_fee NUMERIC(15, 2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  consumed_at TIMESTAMPTZ,
  consumed_booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT booking_special_links_token_min_length
    CHECK (char_length(token) >= 8),
  CONSTRAINT booking_special_links_accommodation_fee_nonnegative
    CHECK (accommodation_fee >= 0),
  CONSTRAINT booking_special_links_discount_amount_nonnegative
    CHECK (discount_amount >= 0),
  CONSTRAINT booking_special_links_package_locked_requires_ids
    CHECK (
      package_locked = false
      OR COALESCE(array_length(package_service_ids, 1), 0) > 0
    ),
  CONSTRAINT booking_special_links_addon_locked_requires_ids
    CHECK (
      addon_locked = false
      OR COALESCE(array_length(addon_service_ids, 1), 0) > 0
    )
);

CREATE INDEX IF NOT EXISTS booking_special_links_user_created_idx
  ON public.booking_special_links (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS booking_special_links_user_active_idx
  ON public.booking_special_links (user_id, is_active, consumed_at);

CREATE OR REPLACE FUNCTION public.update_booking_special_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS booking_special_links_set_updated_at
  ON public.booking_special_links;

CREATE TRIGGER booking_special_links_set_updated_at
BEFORE UPDATE ON public.booking_special_links
FOR EACH ROW
EXECUTE PROCEDURE public.update_booking_special_links_updated_at();

ALTER TABLE public.booking_special_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS booking_special_links_select_own ON public.booking_special_links;
DROP POLICY IF EXISTS booking_special_links_insert_own ON public.booking_special_links;
DROP POLICY IF EXISTS booking_special_links_update_own ON public.booking_special_links;
DROP POLICY IF EXISTS booking_special_links_delete_own ON public.booking_special_links;

CREATE POLICY booking_special_links_select_own
ON public.booking_special_links
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY booking_special_links_insert_own
ON public.booking_special_links
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY booking_special_links_update_own
ON public.booking_special_links
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY booking_special_links_delete_own
ON public.booking_special_links
FOR DELETE TO authenticated
USING (user_id = auth.uid());

COMMIT;
