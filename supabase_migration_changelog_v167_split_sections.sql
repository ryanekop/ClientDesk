-- ============================================================
-- MIGRATION: Changelog v1.6.7 split by sections
-- Run this SQL in Supabase SQL Editor
-- ============================================================

-- Remove old single-line v1.6.7 entry (if still present).
DELETE FROM changelog
WHERE version = '1.6.7'
  AND title = 'Form Booking Publik Kini Lebih Fleksibel, Tim Punya Pricelist'
  AND badge = 'update'
  AND published_at = '2026-04-05T10:00:00Z'::timestamptz;

-- Insert v1.6.7 entries as short bullet points grouped by badge.
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
      '1.6.7',
      'Pricelist per anggota tim/freelance',
      'Sekarang setiap anggota tim bisa punya pricelist sendiri dalam bentuk item dan kolom.',
      'new',
      '2026-04-05T10:10:00Z'
    ),
    (
      '1.6.7',
      'Pengaturan multiple pilih paket dan add-on di form publik',
      'Anda bisa atur paket utama dan add-on di form booking publik agar bisa pilih satu saja atau lebih dari satu.',
      'new',
      '2026-04-05T10:11:00Z'
    ),
    (
      '1.6.7',
      'Trigger antrian kini bisa dimatikan (Off)',
      'Di pengaturan status booking, trigger auto-queue sekarang bisa diatur Off.',
      'improvement',
      '2026-04-05T10:12:00Z'
    ),
    (
      '1.6.7',
      'Status antrian Off tetap konsisten setelah simpan',
      'Mode antrian Off sekarang tidak kembali aktif sendiri setelah simpan atau reload halaman.',
      'fix',
      '2026-04-05T10:13:00Z'
    ),
    (
      '1.6.7',
      'Form publik menolak pilihan ganda saat mode single aktif',
      'Permintaan yang dipaksa multiple sekarang otomatis ditolak jika pengaturan publik diset hanya boleh satu pilihan.',
      'fix',
      '2026-04-05T10:14:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog c
  WHERE c.version = entry.version
    AND c.published_at = entry.published_at::timestamptz
);
