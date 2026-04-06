-- Migration: Persist booking location coordinates for precise maps links and routing
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS location_lat double precision,
ADD COLUMN IF NOT EXISTS location_lng double precision;
