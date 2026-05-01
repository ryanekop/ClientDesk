-- ============================================================
-- MIGRATION: Changelog v1.8.5 (Pembayaran Tim)
-- Catatan:
-- - Append: tidak menghapus changelog yang sudah ada.
-- - Hanya menambah poin baru jika belum ada.
-- - Bahasa dibuat singkat, per poin, dan mudah dipahami user awam.
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
      '1.8.5',
      'Sidebar lebih rapi',
      'Menu sekarang dikelompokkan menjadi Operasional, Finansial, dan Form agar lebih mudah dicari.',
      'improvement',
      '2026-05-01T09:00:00Z'
    ),
    (
      '1.8.5',
      'Menu Pembayaran Tim ditambahkan',
      'Admin bisa melihat daftar tim atau freelance yang terhubung ke booking dan status pembayarannya.',
      'new',
      '2026-05-01T09:01:00Z'
    ),
    (
      '1.8.5',
      'Booking lama ikut terbaca',
      'Pembayaran Tim juga membaca data freelance dari booking lama, jadi data sebelumnya tetap muncul.',
      'fix',
      '2026-05-01T09:02:00Z'
    ),
    (
      '1.8.5',
      'Nominal tim bisa otomatis terisi',
      'Nominal awal pembayaran tim diambil dari Biaya Operasional booking jika nama atau role tim cocok.',
      'improvement',
      '2026-05-01T09:03:00Z'
    ),
    (
      '1.8.5',
      'Pembayaran tim tetap bisa diedit manual',
      'Admin tetap bisa mengubah nominal, catatan, dan status lunas tanpa mengubah invoice klien.',
      'improvement',
      '2026-05-01T09:04:00Z'
    ),
    (
      '1.8.5',
      'Kelola pembayaran tim lebih lengkap',
      'Tersedia pencarian, filter, sort, export Excel, kelola kolom, sembunyikan nominal, dan tandai lunas massal.',
      'new',
      '2026-05-01T09:05:00Z'
    ),
    (
      '1.8.5',
      'Tampilan Pembayaran Tim dirapikan',
      'Tabel desktop dan tampilan mobile dibuat lebih jelas agar detail booking di dalam tim lebih mudah dibaca.',
      'improvement',
      '2026-05-01T09:06:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog c
  WHERE c.version = entry.version
    AND c.published_at = entry.published_at::timestamptz
);
