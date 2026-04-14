-- ============================================================
-- Migration: Special Booking Disable DP
-- ============================================================

BEGIN;

ALTER TABLE public.booking_special_links
  ADD COLUMN IF NOT EXISTS disable_dp BOOLEAN NOT NULL DEFAULT false;

COMMIT;
