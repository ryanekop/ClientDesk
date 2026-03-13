-- ============================================================
-- MIGRATION: Changelog v1.5.1
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
      '1.5.1',
      'Popup Changelog di Dashboard',
      'Log perubahan terbaru sekarang muncul otomatis saat admin membuka dashboard.',
      'new',
      '2026-03-13T09:00:00Z'
    ),
    (
      '1.5.1',
      'Halaman Log Perubahan Lengkap',
      'Klik tombol Log Perubahan di kanan atas sekarang membuka halaman riwayat changelog lengkap dari versi lama sampai terbaru.',
      'new',
      '2026-03-13T08:55:00Z'
    ),
    (
      '1.5.1',
      'Simpan Preferensi di Browser',
      'Centang Jangan tampilkan lagi sekarang disimpan di browser user, bukan ke database.',
      'improvement',
      '2026-03-13T08:50:00Z'
    ),
    (
      '1.5.1',
      'Tampilan Changelog Lebih Ringkas',
      'Ukuran heading, kartu, dan tipografi halaman changelog dibuat lebih proporsional agar nyaman dibaca.',
      'improvement',
      '2026-03-13T08:45:00Z'
    ),
    (
      '1.5.1',
      'Checkbox Ikut Tema',
      'Checkbox Jangan tampilkan lagi sekarang mengikuti tema aplikasi seperti komponen lain.',
      'fix',
      '2026-03-13T08:40:00Z'
    ),
    (
      '1.5.1',
      'Perilaku Popup Saat Reload',
      'Popup changelog akan muncul lagi setelah reload jika opsi Jangan tampilkan lagi tidak dicentang.',
      'fix',
      '2026-03-13T08:35:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog
  WHERE version = '1.5.1'
);
