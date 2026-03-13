-- ============================================================
-- MIGRATION: Changelog v1.5.2 - Calendar extra field variables
-- Run this SQL in Supabase SQL Editor
-- ============================================================

INSERT INTO changelog (version, title, description, badge, published_at)
SELECT
  '1.5.2',
  'Variabel Extra Field di Event Calendar',
  'Format nama event calendar per jenis acara sekarang menampilkan dan memproses variabel extra field sesuai jenis acara yang dipilih, lengkap dengan preview variabelnya di pengaturan.',
  'improvement',
  '2026-03-13T10:05:00Z'::timestamptz
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog
  WHERE version = '1.5.2'
    AND title = 'Variabel Extra Field di Event Calendar'
);
