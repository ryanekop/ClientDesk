-- ============================================================
-- MIGRATION: Changelog v1.8.2 (Metadata Pembayaran Manual)
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
      '1.8.2',
      'Sumber DP bisa dipilih manual',
      'Di booking admin, kamu bisa pilih DP masuk lewat Cash, QRIS, atau rekening yang tersedia.',
      'new',
      '2026-04-27T09:00:00Z'
    ),
    (
      '1.8.2',
      'Tanggal verifikasi DP bisa diatur',
      'Saat input atau edit booking lama, tanggal verifikasi DP bisa diisi manual dan tetap bisa diubah jika perlu.',
      'new',
      '2026-04-27T09:01:00Z'
    ),
    (
      '1.8.2',
      'Pelunasan punya sumber dan tanggal sendiri',
      'Sumber pelunasan dan tanggal pelunasan sekarang bisa diisi terpisah dari DP, jadi catatan pembayaran lebih jelas.',
      'improvement',
      '2026-04-27T09:02:00Z'
    ),
    (
      '1.8.2',
      'Import booking mendukung data pembayaran',
      'File import sekarang bisa membawa sumber DP, tanggal verifikasi DP, sumber pelunasan, dan tanggal pelunasan.',
      'improvement',
      '2026-04-27T09:03:00Z'
    ),
    (
      '1.8.2',
      'Laporan Keuangan mengikuti bulan booking',
      'Booking bulan Mei tetap masuk laporan Mei, walaupun DP atau pelunasannya diverifikasi di tanggal berbeda.',
      'fix',
      '2026-04-27T09:04:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog c
  WHERE c.version = entry.version
    AND c.published_at = entry.published_at::timestamptz
);
