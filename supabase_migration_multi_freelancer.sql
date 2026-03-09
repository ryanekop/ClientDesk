-- ========================================================
-- Migration: Multi-Freelancer Support (max 5 per booking)
-- ========================================================

-- 1. Create junction table
CREATE TABLE IF NOT EXISTS booking_freelancers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  freelancer_id UUID NOT NULL REFERENCES freelancers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(booking_id, freelancer_id)
);

-- 2. Migrate existing freelancer_id data to junction table
INSERT INTO booking_freelancers (booking_id, freelancer_id)
SELECT id, freelancer_id
FROM bookings
WHERE freelancer_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. (Optional) Drop old column after confirming migration
-- ALTER TABLE bookings DROP COLUMN freelancer_id;
-- For now, keep the old column for backward compatibility
