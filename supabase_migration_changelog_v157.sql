-- ============================================================
-- MIGRATION: Changelog v1.5.7
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
      '1.5.7',
      'Crash Tabel Kolom Dinamis Diperbaiki',
      'Nilai extra field dan custom field yang berbentuk array, object, angka, atau boolean sekarang dinormalisasi menjadi teks aman sebelum dirender ke tabel daftar booking, status booking, dan keuangan.',
      'fix',
      '2026-03-13T20:40:00Z'
    ),
    (
      '1.5.7',
      'Reorder Kelola Kolom Lebih Stabil Setelah Data Booking Dimuat',
      'Data metadata tabel sekarang tidak lagi memicu render error saat kolom dinamis aktif, sehingga modal Kelola Kolom bisa dipakai lagi untuk show-hide dan geser urutan kolom tanpa crash halaman.',
      'fix',
      '2026-03-13T20:35:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog
  WHERE version = '1.5.7'
);
