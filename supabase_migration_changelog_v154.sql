-- ============================================================
-- MIGRATION: Changelog v1.5.4
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
      '1.5.4',
      'Filter dan Urutkan Booking Lebih Lengkap',
      'Daftar booking sekarang memisahkan tombol Filter dan Urutkan, dengan urutan default booking terbaru serta opsi booking terlama, jadwal sesi terbaru, dan jadwal sesi terlama.',
      'new',
      '2026-03-13T18:10:00Z'
    ),
    (
      '1.5.4',
      'Multi Paket Utama untuk Booking',
      'Form booking klien dan admin sekarang mendukung lebih dari satu paket utama dalam satu booking, lengkap dengan total harga, minimum DP, invoice, dan template WhatsApp yang memakai nama paket gabungan.',
      'new',
      '2026-03-13T18:05:00Z'
    ),
    (
      '1.5.4',
      'Struktur Folder Google Drive Bertingkat',
      'Pengaturan Google Drive kini mendukung struktur folder bertingkat per jenis acara, termasuk token tahun, bulan, nama klien, kode booking, dan variabel sesi lainnya sebelum masuk ke folder klien.',
      'improvement',
      '2026-03-13T18:00:00Z'
    ),
    (
      '1.5.4',
      'Kolom Tabel Bisa Diatur per Menu',
      'Halaman daftar booking, status booking, keuangan, dan tim/freelance sekarang memiliki pengelolaan kolom tampil/sembunyi dan urutan kolom, dengan Nama dan Aksi tetap terkunci.',
      'improvement',
      '2026-03-13T17:55:00Z'
    ),
    (
      '1.5.4',
      'Preview dan Aksi Tabel Lebih Rapi',
      'Beberapa detail UI diperbaiki, termasuk preview link form pelunasan yang sekarang terpotong rapi dengan elipsis serta alignment kolom aksi di keuangan dan tim yang tidak lagi terlalu mepet ke kanan.',
      'fix',
      '2026-03-13T17:50:00Z'
    ),
    (
      '1.5.4',
      'Template WhatsApp Freelance Kembali Mendukung Extra Field',
      'Variable extra field dan custom field pada template WhatsApp freelance kini muncul lagi sesuai jenis acara dan ikut terisi saat pesan dibuat dari daftar booking maupun detail booking.',
      'fix',
      '2026-03-13T17:45:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog
  WHERE version = '1.5.4'
);
