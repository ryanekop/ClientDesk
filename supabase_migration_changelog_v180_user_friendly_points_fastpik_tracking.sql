-- ============================================================
-- MIGRATION: Changelog v1.8.0 (Fastpik & Tracking Lebih Jelas)
-- Catatan:
-- - Tidak menghapus changelog yang sudah ada.
-- - Hanya menambah poin baru jika belum ada.
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
      '1.8.0',
      'Informasi Fastpik sekarang lebih lengkap',
      'Di detail booking dan tracking klien, informasi Fastpik sekarang tampil lebih lengkap, termasuk status cetak, template cetak, ukuran cetak, dan maksimal jumlah foto.',
      'improvement',
      '2026-04-23T08:00:00Z'
    ),
    (
      '1.8.0',
      'Status Booking lebih cepat dibaca',
      'Halaman Status Booking sekarang menampilkan ringkasan singkat untuk foto, video, cetak, dan batas jumlah foto agar admin tidak perlu buka detail satu per satu.',
      'improvement',
      '2026-04-23T08:01:00Z'
    ),
    (
      '1.8.0',
      'Tracking klien lebih rapi saat video tersedia',
      'Kalau link Fastpik dan video hasil sudah tersedia, tracking klien sekarang otomatis menyembunyikan link Google Drive foto agar klien tidak bingung melihat terlalu banyak pilihan.',
      'fix',
      '2026-04-23T08:02:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog c
  WHERE c.version = entry.version
    AND c.published_at = entry.published_at::timestamptz
);
