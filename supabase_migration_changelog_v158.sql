-- ============================================================
-- MIGRATION: Changelog v1.5.8
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
      '1.5.8',
      'Integrasi Fastpik di Pengaturan ClientDesk',
      'Tab Fastpik baru hadir di antara tab Google dan Bot Telegram, lengkap dengan status integrasi, mode sinkronisasi, pilihan preset source, API key, tombol test koneksi, batch sync, dan log sinkron terakhir.',
      'new',
      '2026-03-17T20:05:00Z'
    ),
    (
      '1.5.8',
      'Sinkronisasi Booking ke Fastpik (Manual + Auto)',
      'Ditambahkan endpoint integrasi Fastpik untuk test koneksi, sync per booking, dan sync batch ber-chunk. Sync auto kini berjalan setelah create/edit booking dan setelah update link Google Drive dari popup.',
      'new',
      '2026-03-17T20:06:00Z'
    ),
    (
      '1.5.8',
      'Prioritas Link Fastpik di Detail dan Tracking',
      'Halaman detail booking dan tracking sekarang memprioritaskan link Fastpik sebagai link utama pemilihan foto. Link Google Drive tetap tersedia sebagai fallback/opsional.',
      'improvement',
      '2026-03-17T20:07:00Z'
    ),
    (
      '1.5.8',
      'Stabilitas Sync: Retry Ringan + Timeout + Log Status',
      'Flow sinkronisasi Fastpik ditingkatkan dengan retry ringan dan timeout agar lebih tahan gangguan jaringan, serta pencatatan status per booking dan per tenant (idle/syncing/success/warning/failed).',
      'fix',
      '2026-03-17T20:08:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog
  WHERE version = '1.5.8'
);
