-- Migration: Add event_types column to services table
-- Purpose: Allow packages/services to be segmented by event type
-- NULL = service available for all event types (backward compatible)
ALTER TABLE services ADD COLUMN IF NOT EXISTS event_types text[] DEFAULT NULL;

-- Add instagram column to bookings table if not exists
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS instagram text DEFAULT NULL;
