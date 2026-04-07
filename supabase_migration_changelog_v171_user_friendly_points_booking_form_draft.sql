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
      'Form booking sekarang tetap terisi saat halaman ter-refresh',
      'Kalau klien tidak sengaja reload halaman, isian form booking yang sudah diisi tidak langsung hilang.',
      'fix',
      '2026-04-07T09:22:00Z'
    ),
    (
      '1.7.1',
      'Langkah booking terakhir ikut tersimpan',
      'Saat form dibuka lagi di sesi browser yang sama, langkah terakhir yang sedang dikerjakan bisa lanjut tanpa mulai dari awal.',
      'improvement',
      '2026-04-07T09:23:00Z'
    ),
    (
      '1.7.1',
      'Ringkasan booking sekarang lebih bersih',
      'Label di ringkasan sesi dibuat lebih ringkas supaya informasi penting lebih enak dibaca.',
      'improvement',
      '2026-04-07T09:24:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog c
  WHERE c.version = entry.version
    AND c.published_at = entry.published_at::timestamptz
);
