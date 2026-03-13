-- ============================================================
-- MIGRATION: Changelog v1.5.2 tambahan
-- Run this SQL in Supabase SQL Editor
-- Tujuan: menambah entry baru versi 1.5.2 tanpa menghapus entry lama
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
      'Syarat & Ketentuan di Form Booking',
      'Sekarang Anda bisa menampilkan checkbox Syarat & Ketentuan di bagian bawah form booking agar klien bisa membaca dan menyetujui sebelum mengirim form.',
      'new',
      '2026-03-13T10:10:00Z'
    ),
    (
      '1.5.2',
      'Popup Syarat Lebih Fleksibel',
      'Isi popup Syarat & Ketentuan sekarang bisa diatur lebih bebas dengan format seperti judul, bold, bullet list, dan numbering agar lebih enak dibaca.',
      'improvement',
      '2026-03-13T10:08:00Z'
    ),
    (
      '1.5.2',
      'Pengaturan T&C Lebih Nyaman',
      'Letak pengaturan Syarat & Ketentuan dipindah ke Pengaturan Umum Form Booking, dan proses editnya dibuat lebih nyaman saat preview sedang terbuka.',
      'fix',
      '2026-03-13T10:06:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog
  WHERE changelog.version = entry.version
    AND changelog.title = entry.title
);
