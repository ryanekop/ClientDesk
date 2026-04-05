-- ============================================================
-- Migration: Tracking hide queue number setting
-- ============================================================

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tracking_hide_queue_number BOOLEAN DEFAULT false;

UPDATE public.profiles
SET tracking_hide_queue_number = false
WHERE tracking_hide_queue_number IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN tracking_hide_queue_number SET DEFAULT false;

ALTER TABLE public.profiles
  ALTER COLUMN tracking_hide_queue_number SET NOT NULL;

COMMIT;
