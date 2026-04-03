-- ============================================================
-- MIGRATION: Changelog v1.6.6
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
      '1.6.6',
      'Filter Daftar Booking, Status, dan Keuangan Kini Selalu Sesuai Input Terbaru',
      'Saat kamu ubah search/filter ketika data masih loading, hasil akhir sekarang tetap mengikuti input terakhir, jadi tidak balik ke data lama.',
      'fix',
      '2026-04-03T10:00:00Z'
    ),
    (
      '1.6.6',
      'Request Filter Lama Sekarang Otomatis Dibatalkan',
      'Kalau kamu ganti filter atau mengetik cepat berturut-turut, request sebelumnya otomatis dihentikan supaya tampilan lebih konsisten dan stabil.',
      'improvement',
      '2026-04-03T10:01:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog
  WHERE version = '1.6.6'
);
