-- ============================================================
-- MIGRATION: Changelog v1.5.6
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
      '1.5.6',
      'Build dan Type Safety Modul Booking Lebih Stabil',
      'Normalisasi data paket booking kini lebih tahan terhadap bentuk relasi Supabase yang berubah-ubah, sehingga daftar booking, detail booking, keuangan, status booking, dan invoice tetap berjalan konsisten untuk booking multi paket.',
      'fix',
      '2026-03-13T20:10:00Z'
    ),
    (
      '1.5.6',
      'Settings Google Drive Tidak Lagi Menarik Library Server ke Client',
      'Helper struktur folder Google Drive dipisah dari util server-only sehingga halaman pengaturan tetap ringan dan proses build produksi tidak gagal karena dependensi Node milik Google API ikut masuk ke bundle client.',
      'fix',
      '2026-03-13T20:05:00Z'
    ),
    (
      '1.5.6',
      'Preferensi Kolom Tabel Lebih Aman Saat Dimuat',
      'Normalisasi preferensi kolom per menu dirapikan agar data tersimpan yang tidak lengkap tetap bisa dibaca dengan aman tanpa memutus render tabel maupun proses build TypeScript.',
      'improvement',
      '2026-03-13T20:00:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog
  WHERE version = '1.5.6'
);
