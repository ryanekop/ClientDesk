-- ============================================================
-- MIGRATION: Changelog v1.6.6 (SEO Settings UX Revision)
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
      'Variabel SEO Sekarang Bisa Diklik',
      'Di tab SEO, token seperti {{studio_name}} sekarang bisa diklik dan langsung masuk ke posisi kursor. Jadi tidak perlu copy-paste manual lagi.',
      'improvement',
      '2026-04-04T14:20:00Z'
    ),
    (
      '1.6.6',
      'Open Graph Manual di Tab SEO Dihapus',
      'Upload gambar Open Graph manual di tab SEO sudah tidak dipakai. Preview WhatsApp/Facebook sekarang otomatis ambil dari logo yang tersedia (logo invoice, avatar, lalu logo tenant).',
      'update',
      '2026-04-04T14:21:00Z'
    ),
    (
      '1.6.6',
      'SEO Sekarang Punya Tampilan Default & Fallback yang Lebih Jelas',
      'Di tiap section SEO sekarang ada info default aktif saat kosong, urutan fallback (Section -> Global -> Default), dan preview hasil akhir supaya lebih mudah dipahami.',
      'new',
      '2026-04-04T14:22:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog c
  WHERE c.version = entry.version
    AND c.published_at = entry.published_at::timestamptz
);
