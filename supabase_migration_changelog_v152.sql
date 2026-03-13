-- ============================================================
-- MIGRATION: Changelog v1.5.2
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
      '1.5.2',
      'Template WA Freelancer Punya Variabel Jam',
      'Template WhatsApp ke freelancer sekarang mendukung variabel {{session_time}} supaya jam sesi bisa ditaruh terpisah dari tanggal.',
      'improvement',
      '2026-03-13T10:00:00Z'
    ),
    (
      '1.5.2',
      'Format Google Per Jenis Acara',
      'Format nama event Google Calendar dan nama folder klien Google Drive sekarang bisa dibedakan untuk tiap jenis acara, termasuk dukungan variabel extra field dari form booking.',
      'new',
      '2026-03-13T09:55:00Z'
    ),
    (
      '1.5.2',
      'Preview dan Tombol Variabel Google',
      'Pengaturan format nama event calendar dan format nama folder klien sekarang dilengkapi preview hasil, tombol variabel yang bisa diklik, dan panel format folder klien terpisah dari kotak koneksi Google Drive.',
      'improvement',
      '2026-03-13T09:52:00Z'
    ),
    (
      '1.5.2',
      'Metode Pembayaran Full Width',
      'Kartu metode pembayaran di pengaturan form booking dan form booking publik sekarang ditampilkan full width dengan susunan stack vertikal agar lebih rapi dan mudah dipilih.',
      'improvement',
      '2026-03-13T09:51:00Z'
    ),
    (
      '1.5.2',
      'Sinkron Google Calendar Lebih Akurat',
      'Perbaikan sinkronisasi tanggal dan jam ke Google Calendar agar waktu acara mengikuti jam yang diinput di aplikasi tanpa bergeser hari atau jam.',
      'fix',
      '2026-03-13T09:50:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog
  WHERE version = '1.5.2'
);
