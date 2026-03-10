-- Migration: Add min_dp_map column for per-event-type minimum DP percentages
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS min_dp_map jsonb DEFAULT '{}';
