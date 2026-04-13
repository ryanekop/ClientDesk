-- ============================================================
-- MIGRATION: Changelog v1.7.4 (Bahasa User Awam, Per Poin)
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
      '1.7.4',
      'Sekarang ada Panduan Setup untuk bantu mulai lebih cepat',
      'User baru sekarang bisa mengikuti langkah awal langsung di dalam aplikasi, jadi tidak bingung harus mulai dari mana.',
      'new',
      '2026-04-13T08:00:00Z'
    ),
    (
      '1.7.4',
      'Progress setup bisa dibuka lagi kapan saja',
      'Panduan Setup sekarang bisa dibuka ulang saat dibutuhkan, jadi langkah yang belum selesai bisa dilanjutkan lagi.',
      'improvement',
      '2026-04-13T08:01:00Z'
    ),
    (
      '1.7.4',
      'Tutorial sekarang dipisah dari Panduan Setup',
      'Panduan Setup dipakai untuk langkah awal, sedangkan Tutorial dipakai untuk belajar fitur dengan lebih jelas.',
      'new',
      '2026-04-13T08:02:00Z'
    ),
    (
      '1.7.4',
      'Isi tutorial sekarang lebih ringkas dan mudah diikuti',
      'Topik tutorial sekarang lebih rapi dan lebih mudah dibaca, jadi user bisa lebih cepat paham langkah yang perlu dilakukan.',
      'improvement',
      '2026-04-13T08:03:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog c
  WHERE c.version = entry.version
    AND c.published_at = entry.published_at::timestamptz
);
