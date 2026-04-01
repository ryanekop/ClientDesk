-- ============================================================
-- MIGRATION: Changelog v1.6.5
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
      '1.6.5',
      'Import Booking Excel Sekarang Lebih Praktis',
      'Proses batch import sudah diperbarui ke alur yang lebih stabil, termasuk ID import otomatis dan contoh template yang lebih jelas.',
      'new',
      '2026-04-02T10:00:00Z'
    ),
    (
      '1.6.5',
      'Daftar Admin Lebih Cepat dan Nyaman',
      'Halaman booking dan keuangan kini pakai pagination server-side, ditambah skeleton loading agar perpindahan data terasa lebih ringan.',
      'improvement',
      '2026-04-02T10:01:00Z'
    ),
    (
      '1.6.5',
      'Booking Otomatis Read-Only Saat Akun Expired',
      'Akun yang masa aktifnya habis sekarang langsung masuk mode baca saja, jadi data lama tetap aman tanpa edit tidak sengaja.',
      'new',
      '2026-04-02T10:02:00Z'
    ),
    (
      '1.6.5',
      'Alur Booking Mobile, QRIS, dan Universitas Lebih Stabil',
      'Perbaikan dilakukan di form booking mobile, tampilan QRIS, serta referensi universitas supaya proses input dan tampilan lebih konsisten.',
      'fix',
      '2026-04-02T10:03:00Z'
    ),
    (
      '1.6.5',
      'Bahasa Internal dan Filter Data Makin Rapi',
      'String internal kini lebih konsisten lintas halaman, ditambah penyempurnaan filter, sort, multiselect, dan rentang tanggal.',
      'improvement',
      '2026-04-02T10:04:00Z'
    ),
    (
      '1.6.5',
      'Mode Split WhatsApp dan Kalender Lebih Sinkron',
      'Template WhatsApp dan deskripsi kalender kini lebih selaras untuk mode normal/split, termasuk dukungan paket berbasis kota untuk wisuda.',
      'new',
      '2026-04-02T10:05:00Z'
    ),
    (
      '1.6.5',
      'Tabel Lebih Fleksibel untuk Kebutuhan Harian',
      'Sekarang tersedia resize kolom, reset lebar kolom, kunci posisi nomor baris, dan toggle visibilitas nominal uang di dashboard/keuangan.',
      'improvement',
      '2026-04-02T10:06:00Z'
    ),
    (
      '1.6.5',
      'Stabilitas Runtime dan Settings Ditingkatkan',
      'Peningkatan dilakukan untuk runtime auth/cache, stabilitas table manager, serta perapian settings, preferensi warna tabel, dan peringatan QRIS Drive.',
      'fix',
      '2026-04-02T10:07:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog
  WHERE version = '1.6.5'
);
