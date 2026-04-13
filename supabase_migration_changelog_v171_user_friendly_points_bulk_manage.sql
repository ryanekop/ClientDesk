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
      'Sekarang ada mode Kelola untuk pilih banyak data sekaligus',
      'Anda bisa centang beberapa data sekaligus tanpa harus klik satu per satu.',
      'new',
      '2026-04-07T09:27:00Z'
    ),
    (
      '1.7.1',
      'Daftar Booking, Status Booking, dan Invoice sekarang bisa aksi massal',
      'Beberapa booking sekarang bisa langsung diarsipkan, dikembalikan, atau dihapus sekaligus.',
      'new',
      '2026-04-07T09:28:00Z'
    ),
    (
      '1.7.1',
      'Data di arsip juga bisa dipilih sekaligus',
      'Booking yang sudah masuk arsip sekarang tetap bisa dicentang banyak lalu dikembalikan bersama-sama.',
      'improvement',
      '2026-04-07T09:29:00Z'
    ),
    (
      '1.7.1',
      'Layanan dan Team sekarang lebih cepat dirapikan',
      'Beberapa layanan atau anggota team sekarang bisa dipilih lalu dihapus sekaligus.',
      'improvement',
      '2026-04-07T09:30:00Z'
    ),
    (
      '1.7.1',
      'Pilih Semua sekarang mengikuti data yang sedang tampil',
      'Tombol Pilih Semua hanya memilih data yang sedang terlihat di halaman saat itu agar lebih aman.',
      'improvement',
      '2026-04-07T09:31:00Z'
    ),
    (
      '1.7.1',
      'Mode Kelola sekarang tetap nyaman dipakai di desktop dan mobile',
      'Tampilan centang dan aksi massal sekarang tersedia di tabel maupun kartu mobile.',
      'improvement',
      '2026-04-07T09:32:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog c
  WHERE c.version = entry.version
    AND c.published_at = entry.published_at::timestamptz
);
