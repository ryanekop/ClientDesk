-- ============================================================
-- MIGRATION: Changelog v1.8.4 (Tampilan Status Booking)
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
      '1.8.4',
      'Icon progress klien bisa dipilih sendiri',
      'Di Settings > Status Booking, tiap status sekarang bisa diberi icon agar tracking klien lebih mudah dibaca.',
      'new',
      '2026-04-30T09:00:00Z'
    ),
    (
      '1.8.4',
      'Warna badge status bisa disesuaikan',
      'Warna status di admin bisa diatur dari Settings > Status Booking dan dipakai di daftar booking serta detail booking.',
      'new',
      '2026-04-30T09:01:00Z'
    ),
    (
      '1.8.4',
      'Pengaturan status dibuat lebih rapi',
      'Opsi trigger dan visibilitas di Status Booking kini diberi icon dan urutan yang lebih mudah dipahami.',
      'improvement',
      '2026-04-30T09:02:00Z'
    ),
    (
      '1.8.4',
      'DP bisa diisi 0',
      'Admin sekarang bisa mengisi DP 0 saat membuat booking baru, edit booking, atau mengubah data booking dari admin.',
      'improvement',
      '2026-04-30T09:03:00Z'
    ),
    (
      '1.8.4',
      'Rekening nonaktif tetap muncul saat edit DP',
      'Jika sumber DP sebelumnya memakai rekening yang sekarang nonaktif, rekening itu tetap tampil saat booking diedit.',
      'fix',
      '2026-04-30T09:04:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog c
  WHERE c.version = entry.version
    AND c.published_at = entry.published_at::timestamptz
);
