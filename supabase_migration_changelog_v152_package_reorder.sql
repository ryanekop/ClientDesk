-- ============================================================
-- MIGRATION: Changelog v1.5.2 tambahan - urutan paket
-- Run this SQL in Supabase SQL Editor
-- Tujuan: menambah entry baru versi 1.5.2 tanpa mengubah entry lama
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
      '1.5.2',
      'Urutan Paket dengan Drag & Drop',
      'Halaman Layanan / Paket sekarang punya mode atur urutan dengan drag & drop agar posisi paket di form booking publik bisa diubah lebih cepat dan nyaman.',
      'improvement',
      '2026-03-13T10:15:00Z'
    ),
    (
      '1.5.2',
      'Paket Utama dan Add-on Dipisah',
      'Daftar paket di halaman admin sekarang dipisah jelas antara paket utama dan add-on dengan divider permanen supaya katalog lebih rapi dan mudah dikelola.',
      'improvement',
      '2026-03-13T10:14:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog
  WHERE changelog.version = entry.version
    AND changelog.title = entry.title
);
