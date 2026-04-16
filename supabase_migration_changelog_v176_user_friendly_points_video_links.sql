-- ============================================================
-- MIGRATION: Changelog v1.7.6 (Link Hasil Foto & Video)
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
      '1.7.6',
      'Link hasil foto sekarang lebih jelas',
      'Field Google Drive untuk hasil foto sekarang diberi nama lebih jelas, jadi tidak tertukar dengan link lain.',
      'improvement',
      '2026-04-17T08:00:00Z'
    ),
    (
      '1.7.6',
      'Link hasil video bisa dibagikan lewat ClientDesk',
      'Admin bisa menyiapkan link hasil video terpisah, lalu klien membukanya dari halaman ClientDesk yang lebih rapi.',
      'new',
      '2026-04-17T08:01:00Z'
    ),
    (
      '1.7.6',
      'Status tampil video bisa diatur sendiri',
      'Link video bisa diatur mulai tampil dari status tertentu, default-nya saat File Siap.',
      'improvement',
      '2026-04-17T08:02:00Z'
    ),
    (
      '1.7.6',
      'Tracking klien tetap bersih saat video belum tersedia',
      'Jika link video belum diisi, bagian video tidak muncul di halaman tracking klien.',
      'improvement',
      '2026-04-17T08:03:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog c
  WHERE c.version = entry.version
    AND c.published_at = entry.published_at::timestamptz
);
