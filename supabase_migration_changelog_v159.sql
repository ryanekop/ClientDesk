-- ============================================================
-- MIGRATION: Changelog v1.5.9
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
      '1.5.9',
      'Form Booking Khusus untuk Klien Tertentu',
      'Sekarang Anda bisa membuat link form booking khusus untuk kebutuhan tertentu, misalnya klien luar kota, acara khusus, atau skema harga yang berbeda dari booking biasa.',
      'new',
      '2026-03-18T12:10:00Z'
    ),
    (
      '1.5.9',
      'Lock/Unlock Jenis Acara, Paket, dan Add-on',
      'Di form booking khusus, admin sekarang bisa mengunci atau membebaskan pilihan Jenis Acara, Paket, dan Add-on sesuai skenario layanan yang diinginkan.',
      'new',
      '2026-03-18T12:11:00Z'
    ),
    (
      '1.5.9',
      'Rincian Harga Awal Lebih Transparan',
      'Perhitungan harga awal sekarang lebih jelas karena komponen paket, add-on, akomodasi, dan diskon ditampilkan lebih rapi dan mudah dipahami.',
      'improvement',
      '2026-03-18T12:12:00Z'
    ),
    (
      '1.5.9',
      'Data Keuangan, Invoice, dan Tracking Lebih Sinkron',
      'Perhitungan total, sisa pembayaran, dan ringkasan harga sekarang lebih konsisten di halaman Detail Booking, Keuangan, Tracking, dan Invoice.',
      'improvement',
      '2026-03-18T12:13:00Z'
    ),
    (
      '1.5.9',
      'Tampilan Invoice Lebih Jelas untuk Add-on',
      'Bagian layanan dan add-on pada invoice dibuat lebih jelas pemisahannya supaya nilai subtotal dan item layanan lebih mudah dibaca oleh klien.',
      'improvement',
      '2026-03-18T12:14:00Z'
    ),
    (
      '1.5.9',
      'Notifikasi Sukses dan Salin Link Lebih Seragam',
      'Notifikasi berhasil simpan dan salin link sekarang tampil dengan gaya yang lebih konsisten di beberapa halaman utama agar pengalaman penggunaan lebih nyaman.',
      'improvement',
      '2026-03-18T12:15:00Z'
    ),
    (
      '1.5.9',
      'Status Progress Klien Lebih Aman',
      'Urutan status progress klien sekarang lebih terjaga: Pending tetap di awal dan Selesai tetap di akhir, sehingga alur tracking lebih rapi.',
      'fix',
      '2026-03-18T12:16:00Z'
    ),
    (
      '1.5.9',
      'Kirim Invoice Final Lebih Stabil',
      'Proses kirim invoice final ke WhatsApp diperbaiki agar lebih stabil dan tidak membuka tab ganda saat tombol diklik.',
      'fix',
      '2026-03-18T12:17:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog
  WHERE version = '1.5.9'
);
