-- ============================================================
-- MIGRATION: Changelog v1.5.9
-- Run this SQL in Supabase SQL Editor
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
      '1.5.9',
      'Unifikasi Jenis Acara Custom/Lainnya',
      'Jenis acara Lainnya sekarang disatukan menjadi Custom/Lainnya di seluruh area utama, termasuk admin dan form booking publik, agar tidak ada lagi duplikasi opsi.',
      'improvement',
      '2026-03-17T23:10:00Z'
    ),
    (
      '1.5.9',
      'Custom/Lainnya Menampilkan Semua Paket',
      'Saat klien atau admin memilih Custom/Lainnya, daftar paket utama dan add-on sekarang menampilkan semua paket aktif tanpa dibatasi assignment event type.',
      'new',
      '2026-03-17T23:11:00Z'
    ),
    (
      '1.5.9',
      'Migrasi Otomatis Data Lainnya Lama',
      'Data event type lama bernama Lainnya kini dimigrasikan otomatis ke Custom/Lainnya pada booking, template, paket, dan pengaturan map agar konsisten.',
      'fix',
      '2026-03-17T23:12:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog
  WHERE version = '1.5.9'
);
