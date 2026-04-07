-- ============================================================
-- MIGRATION: Changelog v1.7.1 (Bahasa User Awam, Per Poin)
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
      '1.7.1',
      'Paket yang sama sekarang bisa dipilih lebih dari 1 kali',
      'Di form booking, Anda sekarang bisa memilih paket atau add-on yang sama lebih dari satu kali sesuai kebutuhan.',
      'new',
      '2026-04-07T09:16:00Z'
    ),
    (
      '1.7.1',
      'Jumlah paket sekarang tercatat otomatis',
      'Sistem sekarang menyimpan jumlah tiap paket atau add-on yang dipilih, jadi tidak perlu input manual berulang.',
      'improvement',
      '2026-04-07T09:17:00Z'
    ),
    (
      '1.7.1',
      'Total harga langsung mengikuti jumlah yang dipilih',
      'Kalau paket atau add-on dipilih lebih dari satu, total harga booking akan dihitung otomatis sesuai jumlahnya.',
      'improvement',
      '2026-04-07T09:18:00Z'
    ),
    (
      '1.7.1',
      'Durasi layanan ikut menyesuaikan jumlah paket',
      'Estimasi durasi booking sekarang ikut bertambah otomatis kalau paket atau add-on yang memengaruhi jadwal dipilih lebih dari satu.',
      'improvement',
      '2026-04-07T09:19:00Z'
    ),
    (
      '1.7.1',
      'Admin sekarang bisa atur jumlah paket saat buat atau edit booking',
      'Di halaman booking admin, jumlah paket dan add-on sekarang bisa diatur langsung tanpa perlu trik manual.',
      'new',
      '2026-04-07T09:20:00Z'
    ),
    (
      '1.7.1',
      'Invoice dan tracking sekarang menampilkan jumlah item',
      'Di invoice, detail booking, tracking, dan settlement, jumlah paket atau add-on sekarang tampil lebih jelas, misalnya x2 atau x3.',
      'improvement',
      '2026-04-07T09:21:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog c
  WHERE c.version = entry.version
    AND c.published_at = entry.published_at::timestamptz
);
