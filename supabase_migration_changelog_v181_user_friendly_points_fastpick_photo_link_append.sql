-- ============================================================
-- MIGRATION: Changelog v1.8.1 (Link Pilih Foto & Sync FastPick)
-- Catatan:
-- - Append: tidak menghapus changelog yang sudah ada.
-- - Hanya menambah poin baru jika belum ada.
-- - Bahasa dibuat singkat, guided, dan mudah dipahami user awam.
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
      '1.8.1',
      'Link pilih foto sekarang diisi manual',
      'Di Detail Booking, klik Masukkan Link Pilih Foto, tempel link Google Drive hasil foto, lalu simpan. Sistem tidak lagi membuat folder Drive baru dari tombol ini.',
      'fix',
      '2026-04-26T08:03:00Z'
    ),
    (
      '1.8.1',
      'Sync FastPick memakai link foto yang benar',
      'Setelah link pilih foto disimpan, sistem otomatis sync ke FastPick memakai link Google Drive yang baru kamu tempel.',
      'improvement',
      '2026-04-26T08:04:00Z'
    ),
    (
      '1.8.1',
      'Folder bukti pembayaran tidak ikut terkirim',
      'FastPick tidak lagi otomatis memakai folder booking yang bisa berisi bukti pembayaran. Klien hanya menerima link foto yang memang kamu masukkan.',
      'fix',
      '2026-04-26T08:05:00Z'
    ),
    (
      '1.8.1',
      'Link foto bisa diubah dari Detail Booking',
      'Jika link sudah ada, klik Ubah Link Pilih Foto untuk mengganti link tanpa perlu masuk ke halaman Edit Booking.',
      'improvement',
      '2026-04-26T08:06:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog c
  WHERE c.version = entry.version
    AND c.published_at = entry.published_at::timestamptz
);
