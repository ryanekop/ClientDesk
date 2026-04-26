-- ============================================================
-- MIGRATION: Changelog v1.8.1 (Rekening Pembayaran di Invoice)
-- Catatan:
-- - Tidak menghapus changelog yang sudah ada.
-- - Hanya menambah poin baru jika belum ada.
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
      '1.8.1',
      'Rekening pembayaran bisa ditampilkan di PDF invoice',
      'Buka Pengaturan > Keuangan, aktifkan Tampilkan di PDF invoice, lalu pilih rekening yang ingin muncul. Setelah disimpan, invoice akan menampilkan nama bank, nomor rekening, dan nama rekening.',
      'new',
      '2026-04-26T08:00:00Z'
    ),
    (
      '1.8.1',
      'Pilih rekening yang tampil untuk pembayaran',
      'Centang satu atau beberapa rekening di Pengaturan > Keuangan. Rekening yang tidak dicentang tetap tersimpan, tapi tidak akan tampil di PDF invoice.',
      'improvement',
      '2026-04-26T08:01:00Z'
    ),
    (
      '1.8.1',
      'Fitur rekening invoice bisa dinyalakan atau dimatikan',
      'Jika belum ingin menampilkan rekening, matikan Tampilkan di PDF invoice di Pengaturan > Keuangan. PDF invoice akan kembali tampil seperti sebelumnya.',
      'improvement',
      '2026-04-26T08:02:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog c
  WHERE c.version = entry.version
    AND c.published_at = entry.published_at::timestamptz
);
