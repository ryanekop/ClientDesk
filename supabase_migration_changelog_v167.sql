-- ============================================================
-- MIGRATION: Changelog v1.6.7
-- Run this SQL in Supabase SQL Editor
-- ============================================================

INSERT INTO changelog (version, title, description, badge, published_at)
SELECT
  entry.version,
  entry.title,
  entry.description,
  entry.badge,
  entry.published_at::timestamptz
FROM (
  VALUES
    (
      '1.6.7',
      'Form Booking Publik Kini Lebih Fleksibel, Tim Punya Pricelist',
      'Sekarang Anda bisa atur apakah paket utama dan add-on di form booking publik boleh dipilih lebih dari satu atau hanya satu. Di pengaturan status, trigger antrian juga bisa dimatikan (Off). Selain itu, setiap anggota tim/freelance sekarang punya pricelist sendiri dalam bentuk item dan kolom yang mudah diisi.',
      'update',
      '2026-04-05T10:00:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog c
  WHERE c.version = entry.version
    AND c.published_at = entry.published_at::timestamptz
);
