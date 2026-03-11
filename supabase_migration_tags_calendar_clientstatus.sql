-- ============================================================
-- Migration: Tags, Calendar Event Format, Custom Client Statuses
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Tags for freelancers (stored as JSON array in freelance table)
ALTER TABLE public.freelance
ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;

-- 2. Calendar event format for profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS calendar_event_format text DEFAULT '📸 {{client_name}} — {{service_name}}';

-- 3. Custom client statuses (progress steps shown to clients)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS custom_client_statuses jsonb DEFAULT '["Booking Confirmed","Sesi Foto / Acara","Antrian Edit","Proses Edit","Revisi","File Siap","Selesai"]'::jsonb;

-- 4. Queue trigger status (which client status triggers auto-queue)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS queue_trigger_status text DEFAULT 'Antrian Edit';
