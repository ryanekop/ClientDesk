-- ============================================================
-- MIGRATION: Changelog v1.7.7 (Perbaikan Booking & Invoice)
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
      '1.7.7',
      'Add-on tambahan sekarang tampil lebih akurat di Invoice & Pelunasan',
      'Jika ada add-on yang ditambahkan setelah booking berjalan, nilainya sekarang lebih konsisten tampil di kolom Add-on.',
      'fix',
      '2026-04-20T08:00:00Z'
    ),
    (
      '1.7.7',
      'Simpan edit dari Invoice & Pelunasan sekarang kembali ke halaman semula',
      'Kalau buka Edit Booking dari halaman Invoice & Pelunasan, setelah simpan kamu akan diarahkan kembali ke halaman itu, jadi tidak perlu pindah manual.',
      'improvement',
      '2026-04-20T08:01:00Z'
    ),
    (
      '1.7.7',
      'Status lunas tidak lagi berubah saat biaya operasional diperbarui',
      'Update biaya operasional sekarang tidak membuat booking yang sudah lunas kembali terbaca belum lunas.',
      'fix',
      '2026-04-20T08:02:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog c
  WHERE c.version = entry.version
    AND c.published_at = entry.published_at::timestamptz
);
