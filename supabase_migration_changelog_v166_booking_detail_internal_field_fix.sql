-- ============================================================
-- MIGRATION: Changelog v1.6.6 (booking detail internal field fix)
-- Run this SQL in Supabase SQL Editor
-- Catatan: Script ini hanya MENAMBAH catatan baru, tidak menghapus catatan lama.
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
      'Detail Booking Sekarang Lebih Rapi',
      'Di halaman detail booking, data teknis internal tidak ditampilkan lagi, jadi informasi klien terlihat lebih bersih dan mudah dibaca.',
      'fix',
      '2026-04-04T16:40:00Z'
    ),
    (
      '1.6.6',
      'Perbaikan Ini Aman, Data Lama Tetap Ada',
      'Perubahan ini hanya merapikan tampilan. Data pembagian freelance per sesi tetap tersimpan seperti sebelumnya dan tetap bisa dipakai sistem.',
      'improvement',
      '2026-04-04T16:41:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog c
  WHERE c.version = entry.version
    AND c.published_at = entry.published_at::timestamptz
);
