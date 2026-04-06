-- Migration: Add location_detail column and custom_statuses column
-- Run this in Supabase SQL Editor

-- Detail Lokasi: optional text field for additional location info
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS location_detail text DEFAULT NULL;

-- Custom Statuses: vendor can define their own booking statuses
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS custom_statuses jsonb DEFAULT '["Pending","DP","Terjadwal","Selesai","Edit","Batal"]';

-- Default WA Target: who receives WA from booking list button ('client' or 'freelancer')
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS default_wa_target text DEFAULT 'client';
