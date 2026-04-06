-- ============================================================
-- MIGRATION: Changelog v1.6.0
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
      '1.6.0',
      'Add-on di Invoice Lebih Rapi',
      'Di invoice awal dan invoice final, baris add-on sekarang tidak lagi menampilkan tanggal sesi. Tampilan jadi lebih bersih dan lebih gampang dibaca klien.',
      'improvement',
      '2026-03-19T09:00:00Z'
    ),
    (
      '1.6.0',
      'Diskon dan Akomodasi Tetap Aman Setelah Edit',
      'Perhitungan diskon dan biaya akomodasi sekarang tidak hilang saat booking diedit atau saat data pelunasan diperbarui. Nilai di invoice jadi lebih konsisten.',
      'fix',
      '2026-03-19T09:01:00Z'
    ),
    (
      '1.6.0',
      'Bagian Keuangan di Edit Booking Lebih Lengkap',
      'Halaman Edit Booking sekarang menampilkan ringkasan keuangan yang lebih lengkap agar admin bisa cek alur nilai tanpa harus bolak-balik halaman.',
      'improvement',
      '2026-03-19T09:02:00Z'
    ),
    (
      '1.6.0',
      'Panel Keuangan Detail Booking Dibagi per Fase',
      'Ringkasan keuangan di Detail Booking sekarang dipisah per fase (awal, final, dan terverifikasi) supaya alur hitungannya lebih jelas saat dicek.',
      'improvement',
      '2026-03-19T09:03:00Z'
    ),
    (
      '1.6.0',
      'Total Penting Dibuat Lebih Menonjol',
      'Nilai Total Awal, Total Final, dan Total Terverifikasi Bersih sekarang dibuat lebih kontras agar cepat terlihat saat review keuangan.',
      'improvement',
      '2026-03-19T09:04:00Z'
    ),
    (
      '1.6.0',
      'Info Project Fastpik Tampil di Tracking dan Detail',
      'Informasi project Fastpik seperti password, durasi link pilih, durasi link download, dan batas jumlah foto sekarang ikut tampil di halaman yang relevan.',
      'new',
      '2026-03-19T09:05:00Z'
    ),
    (
      '1.6.0',
      'Salin Password Fastpik Lebih Praktis',
      'Di halaman tracking dan detail booking, password Fastpik sekarang bisa langsung disalin lewat tombol khusus supaya tidak perlu copy manual.',
      'improvement',
      '2026-03-19T09:06:00Z'
    ),
    (
      '1.6.0',
      'Sinkronisasi Fastpik Menyimpan Info Project Lebih Stabil',
      'Setiap sinkronisasi Fastpik sekarang menyimpan ringkasan info project dengan fallback yang lebih aman, jadi data tetap terbaca meski respons tidak lengkap.',
      'fix',
      '2026-03-19T09:07:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog
  WHERE version = '1.6.0'
);
