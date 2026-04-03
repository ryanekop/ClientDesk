-- ============================================================
-- MIGRATION: Changelog v1.6.6
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
      '1.6.6',
      'Filter Daftar Booking, Status, dan Keuangan Kini Selalu Sesuai Input Terbaru',
      'Saat kamu ubah search/filter ketika data masih loading, hasil akhir sekarang tetap mengikuti input terakhir, jadi tidak balik ke data lama.',
      'fix',
      '2026-04-03T10:00:00Z'
    ),
    (
      '1.6.6',
      'Request Filter Lama Sekarang Otomatis Dibatalkan',
      'Kalau kamu ganti filter atau mengetik cepat berturut-turut, request sebelumnya otomatis dihentikan supaya tampilan lebih konsisten dan stabil.',
      'improvement',
      '2026-04-03T10:01:00Z'
    ),
    (
      '1.6.6',
      'Pengaturan Kolom Sekarang Tidak Balik Lagi Setelah Ubah Data',
      'Kalau Anda sudah atur urutan atau kunci kolom, pengaturannya sekarang tetap tersimpan meski setelah ganti status atau antrian.',
      'fix',
      '2026-04-03T10:02:00Z'
    ),
    (
      '1.6.6',
      'Tampilan Kolom di Status Booking, Booking, dan Keuangan Lebih Konsisten',
      'Perilaku simpan kolom sekarang diseragamkan di tiga halaman utama, jadi hasilnya lebih stabil dan sesuai pengaturan terakhir Anda.',
      'improvement',
      '2026-04-03T10:03:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog c
  WHERE c.version = entry.version
    AND c.published_at = entry.published_at::timestamptz
);
