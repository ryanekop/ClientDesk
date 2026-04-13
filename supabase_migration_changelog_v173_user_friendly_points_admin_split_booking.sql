-- ============================================================
-- MIGRATION: Changelog v1.7.3 (Bahasa User Awam, Per Poin)
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
      '1.7.3',
      'Booking Wisuda split di admin sekarang menampilkan Lokasi Sesi 1 dan Lokasi Sesi 2',
      'Saat membuat booking Wisuda split, dua lokasi sesi sekarang muncul lagi di form admin.',
      'fix',
      '2026-04-09T09:10:00Z'
    ),
    (
      '1.7.3',
      'Edit booking split sekarang lebih jelas',
      'Saat edit booking split, field lokasi per sesi sekarang tampil sesuai mode yang sedang dipakai.',
      'improvement',
      '2026-04-09T09:11:00Z'
    ),
    (
      '1.7.3',
      'Form admin sekarang lebih pas antara mode normal dan split',
      'Lokasi utama dan lokasi per sesi sekarang tampil sesuai alur booking, jadi tidak saling tertukar.',
      'fix',
      '2026-04-09T09:12:00Z'
    ),
    (
      '1.7.3',
      'Batch booking Wisuda sekarang bisa pilih kota atau kabupaten',
      'Saat import booking Wisuda, Anda sekarang bisa pilih kota atau kabupaten langsung dari daftar saran.',
      'new',
      '2026-04-09T15:10:00Z'
    ),
    (
      '1.7.3',
      'Paket Wisuda hasil import sekarang tetap terbaca saat diedit',
      'Booking Wisuda yang diimport sekarang tetap menampilkan paket yang sudah dipilih saat dibuka di halaman edit.',
      'fix',
      '2026-04-09T15:11:00Z'
    ),
    (
      '1.7.3',
      'Kota Wisuda sekarang membantu menyesuaikan pilihan paket',
      'Sistem sekarang menyesuaikan paket Wisuda berdasarkan kota atau kabupaten yang dipilih agar pilihan layanan lebih tepat.',
      'improvement',
      '2026-04-09T15:12:00Z'
    ),
    (
      '1.7.3',
      'Halaman tracking sekarang langsung memberi tahu saat file hasil sudah siap',
      'Saat file hasil sudah bisa dibuka, klien sekarang langsung melihat pengumuman singkat di halaman tracking tanpa perlu cek satu per satu.',
      'improvement',
      '2026-04-09T19:00:00Z'
    ),
    (
      '1.7.3',
      'Filter tanggal booking split sekarang lebih akurat',
      'Booking Wedding atau Wisuda yang punya tanggal sesi berbeda sekarang tetap ketemu saat difilter per tanggal sesi.',
      'fix',
      '2026-04-09T19:10:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog c
  WHERE c.version = entry.version
    AND c.published_at = entry.published_at::timestamptz
);
