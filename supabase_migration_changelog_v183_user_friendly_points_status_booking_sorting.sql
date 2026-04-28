-- ============================================================
-- MIGRATION: Changelog v1.8.3 (Urutan Status Booking)
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
      '1.8.3',
      'Status Booking bisa diurutkan dari nomor antrian edit',
      'Di halaman Status Booking, pilih Urutkan: Nomor Antrian Edit untuk melihat antrian dari nomor paling kecil.',
      'new',
      '2026-04-28T09:00:00Z'
    ),
    (
      '1.8.3',
      'Status Booking bisa diurutkan dari deadline terdekat',
      'Pilih Urutkan: Deadline Terdekat untuk melihat pekerjaan yang perlu dikejar lebih dulu.',
      'new',
      '2026-04-28T09:01:00Z'
    ),
    (
      '1.8.3',
      'Data tanpa nomor antrian atau deadline tetap rapi',
      'Booking yang belum punya nomor antrian atau deadline akan tampil setelah data yang sudah terisi.',
      'improvement',
      '2026-04-28T09:02:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog c
  WHERE c.version = entry.version
    AND c.published_at = entry.published_at::timestamptz
);
