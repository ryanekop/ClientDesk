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
      'Booking sekarang bisa diarsipkan tanpa dihapus',
      'Booking yang sudah tidak aktif sekarang bisa dipindah ke arsip supaya daftar utama tetap rapi.',
      'new',
      '2026-04-07T09:22:00Z'
    ),
    (
      '1.7.1',
      'Arsip booking otomatis sinkron di semua halaman utama',
      'Kalau satu booking diarsipkan, data itu ikut pindah dari Daftar Booking, Status Booking, dan Invoice & Pelunasan.',
      'improvement',
      '2026-04-07T09:23:00Z'
    ),
    (
      '1.7.1',
      'Booking arsip bisa dibuka lagi kapan saja',
      'Booking yang sudah masuk arsip tetap bisa dikembalikan ke daftar aktif tanpa input ulang.',
      'improvement',
      '2026-04-07T09:24:00Z'
    ),
    (
      '1.7.1',
      'Tombol arsip sekarang tersedia langsung di detail booking',
      'Anda bisa arsipkan atau kembalikan booking langsung dari halaman detail tanpa harus kembali ke daftar.',
      'new',
      '2026-04-07T09:25:00Z'
    ),
    (
      '1.7.1',
      'Link tracking, invoice, dan pelunasan tetap aman saat booking diarsipkan',
      'Arsip hanya merapikan tampilan internal. Link yang sudah dibagikan ke klien tetap bisa dipakai seperti biasa.',
      'improvement',
      '2026-04-07T09:26:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog c
  WHERE c.version = entry.version
    AND c.published_at = entry.published_at::timestamptz
);
