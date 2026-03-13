-- ============================================================
-- MIGRATION: Changelog v1.5.5
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
      '1.5.5',
      'Kolom Dinamis dari Extra Field dan Custom Field',
      'Kelola Kolom di daftar booking, keuangan, dan status booking sekarang bisa menampilkan kolom tambahan dari extra field bawaan acara maupun custom field yang sudah tersimpan di data booking.',
      'new',
      '2026-03-13T19:05:00Z'
    ),
    (
      '1.5.5',
      'Urutan Kolom Sekarang Benar-Benar Mengikuti Pengaturan',
      'Tabel admin sekarang merender kolom berdasarkan urutan yang diatur user, jadi hasil drag atau geser di modal Kelola Kolom langsung tercermin di tampilan tabel.',
      'improvement',
      '2026-03-13T19:00:00Z'
    ),
    (
      '1.5.5',
      'Paket Multi Service Ikut Konsisten di Status dan Keuangan',
      'Label paket utama gabungan sekarang dipakai lebih konsisten di halaman status booking dan keuangan agar hasil booking multi paket tetap terbaca rapi di seluruh modul utama.',
      'fix',
      '2026-03-13T18:55:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog
  WHERE version = '1.5.5'
);
