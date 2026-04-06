-- ============================================================
-- MIGRATION: Changelog v1.7.0 (Bahasa User Awam, Per Poin)
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
      '1.7.0',
      'Informasi Klien di Detail Booking sekarang lebih bersih',
      'Field teknis internal seperti fastpik_project tidak ditampilkan lagi di bagian Informasi Klien, jadi tampilannya lebih rapi dan mudah dibaca.',
      'fix',
      '2026-04-06T15:20:00Z'
    ),
    (
      '1.7.0',
      'Data Fastpik tetap aman dipakai sistem',
      'Perubahan ini hanya merapikan tampilan. Data internal Fastpik tetap tersimpan dan tetap dipakai untuk proses sinkronisasi serta fitur Fastpik.',
      'improvement',
      '2026-04-06T15:21:00Z'
    ),
    (
      '1.7.0',
      'Kolom metadata internal tidak ikut muncul sebagai kolom tambahan',
      'Di tampilan daftar booking, data internal seperti fastpik_project tidak ikut terbaca sebagai metadata umum, sehingga pilihan kolom jadi lebih relevan.',
      'improvement',
      '2026-04-06T15:22:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog c
  WHERE c.version = entry.version
    AND c.published_at = entry.published_at::timestamptz
);
