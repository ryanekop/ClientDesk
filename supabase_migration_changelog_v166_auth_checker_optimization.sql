-- ============================================================
-- MIGRATION: Changelog v1.6.6 (auth checker optimization)
-- Run this SQL in Supabase SQL Editor
-- Catatan: aman dijalankan ulang, tidak akan membuat duplikat.
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
      'Balik ke Tab Setelah Lama Idle Sekarang Lebih Ringan',
      'Saat Anda kembali ke tab yang lama tidak dibuka, halaman sekarang lebih responsif dan tidak mudah terasa macet.',
      'fix',
      '2026-04-04T20:00:00Z'
    ),
    (
      '1.6.6',
      'Pengecekan Login Sekarang Lebih Hemat dan Tidak Berulang Terus',
      'Sistem pengecekan sesi login sekarang dijalankan lebih efisien, jadi tidak membebani koneksi secara berlebihan di belakang layar.',
      'improvement',
      '2026-04-04T20:01:00Z'
    ),
    (
      '1.6.6',
      'Mode "Ingat Saya" Dibuat Lebih Stabil',
      'Jika opsi "Ingat Saya" aktif, sistem tidak lagi melakukan pengecekan yang tidak perlu, sehingga pengalaman penggunaan lebih lancar.',
      'improvement',
      '2026-04-04T20:02:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog c
  WHERE c.version = entry.version
    AND c.published_at = entry.published_at::timestamptz
);
