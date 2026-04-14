-- ============================================================
-- MIGRATION: Changelog v1.7.5 (Shortcut Invoice & Pelunasan)
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
      '1.7.5',
      'Tombol Edit Booking sekarang ada di Invoice & Pelunasan',
      'Dari halaman Invoice & Pelunasan, kamu sekarang bisa langsung buka Edit Booking tanpa perlu pindah halaman dulu.',
      'improvement',
      '2026-04-14T08:04:00Z'
    ),
    (
      '1.7.5',
      'Admin sekarang bisa set biaya operasional lebih cepat',
      'Di halaman Invoice & Pelunasan, admin sekarang punya tombol khusus untuk langsung masuk ke bagian biaya operasional di booking.',
      'new',
      '2026-04-14T08:05:00Z'
    ),
    (
      '1.7.5',
      'Bagian biaya operasional sekarang langsung dituju otomatis',
      'Saat tombol biaya operasional dibuka, halaman edit booking akan langsung mengarah ke bagian yang perlu diisi supaya tidak bingung cari manual.',
      'improvement',
      '2026-04-14T08:06:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog c
  WHERE c.version = entry.version
    AND c.published_at = entry.published_at::timestamptz
);
