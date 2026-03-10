-- ============================================================
-- Migration: Rename freelancers → freelance, booking_freelancers → booking_freelance
-- Also: Add content_en and event_type columns to templates
-- ============================================================

-- 1. Rename tables
ALTER TABLE freelancers RENAME TO freelance;
ALTER TABLE booking_freelancers RENAME TO booking_freelance;

-- 2. Rename freelancer_id column in booking_freelance junction table
ALTER TABLE booking_freelance RENAME COLUMN freelancer_id TO freelance_id;

-- 3. Rename freelancer_id column in bookings table (old FK, backward compat)
ALTER TABLE bookings RENAME COLUMN freelancer_id TO freelance_id;

-- 4. Add bilingual + event type support to templates
ALTER TABLE templates ADD COLUMN IF NOT EXISTS content_en text DEFAULT '';
ALTER TABLE templates ADD COLUMN IF NOT EXISTS event_type text DEFAULT NULL;
