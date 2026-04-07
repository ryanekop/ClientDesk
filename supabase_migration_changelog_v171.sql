-- ============================================================
-- MIGRATION: Changelog v1.7.1
-- Catatan:
-- - Jika poin dengan version + published_at yang sama sudah ada, data akan di-update.
-- - Jika belum ada, data akan di-insert.
-- ============================================================

WITH entries(version, title, description, badge, published_at) AS (
  VALUES
    (
      '1.7.1',
      'Halaman Keuangan baru sudah tersedia',
      'Sekarang ada halaman Keuangan khusus untuk memantau pemasukan, biaya operasional, sumber pembayaran, dan paket terlaris.',
      'new',
      '2026-04-07T09:10:00Z'
    ),
    (
      '1.7.1',
      'Menu lama sekarang jadi Invoice & Pelunasan',
      'Halaman tabel keuangan lama tidak hilang. Sekarang dipindah dan diberi nama Invoice & Pelunasan agar fungsinya lebih jelas.',
      'improvement',
      '2026-04-07T09:11:00Z'
    ),
    (
      '1.7.1',
      'Keuangan sekarang bisa difilter per bulan',
      'Anda bisa pilih Ringkasan Semua atau bulan tertentu untuk melihat alur uang masuk dengan lebih rapi.',
      'new',
      '2026-04-07T09:12:00Z'
    ),
    (
      '1.7.1',
      'Sumber pembayaran sekarang terlihat lebih detail',
      'Cash, QRIS, dan transfer bank sekarang dipisah di ringkasan, termasuk jika Anda memakai beberapa rekening bank.',
      'improvement',
      '2026-04-07T09:13:00Z'
    ),
    (
      '1.7.1',
      'Biaya operasional sekarang bisa dicatat per booking',
      'Tambahkan biaya seperti freelance, cetak, atau kebutuhan lain untuk menghitung pemasukan bersih internal dengan lebih akurat.',
      'new',
      '2026-04-07T09:14:00Z'
    ),
    (
      '1.7.1',
      'Detail booking sekarang menampilkan biaya operasional',
      'Di bagian Keuangan pada detail booking, sekarang terlihat total biaya operasional dan hasil pemasukan bersih setelah dipotong biaya.',
      'improvement',
      '2026-04-07T09:15:00Z'
    )
),
updated AS (
  UPDATE changelog c
  SET
    title = e.title,
    description = e.description,
    badge = e.badge
  FROM entries e
  WHERE c.version = e.version
    AND c.published_at = e.published_at::timestamptz
  RETURNING c.version, c.published_at
)
INSERT INTO changelog (version, title, description, badge, published_at)
SELECT
  e.version,
  e.title,
  e.description,
  e.badge,
  e.published_at::timestamptz
FROM entries e
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog c
  WHERE c.version = e.version
    AND c.published_at = e.published_at::timestamptz
);
