-- ============================================================
-- MIGRATION: Changelog v1.7.2 (Bahasa User Awam, Per Poin)
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
      '1.7.2',
      'Booking Wedding non-split sekarang bisa pilih freelance tanpa error lokasi split',
      'Saat booking admin tidak memakai mode pisah, Anda tidak perlu lagi isi Lokasi Akad dan Lokasi Resepsi hanya untuk menyimpan freelance.',
      'fix',
      '2026-04-08T03:20:00Z'
    ),
    (
      '1.7.2',
      'Booking Wedding dan Wisuda non-split sekarang kembali pakai Lokasi Utama',
      'Kalau acara tidak dipisah sesi, form admin sekarang memakai Lokasi Utama seperti alur normal agar lebih jelas.',
      'improvement',
      '2026-04-08T03:21:00Z'
    ),
    (
      '1.7.2',
      'Lokasi split tidak ikut tersimpan saat mode split dimatikan',
      'Data lokasi khusus sesi tidak akan ikut terbawa ke booking kalau mode split sedang tidak dipakai.',
      'fix',
      '2026-04-08T03:22:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog c
  WHERE c.version = entry.version
    AND c.published_at = entry.published_at::timestamptz
);
