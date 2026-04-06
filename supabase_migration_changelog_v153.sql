-- ============================================================
-- MIGRATION: Changelog v1.5.3
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
      '1.5.3',
      'Workflow Pelunasan Final',
      'Pemisahan invoice awal dan invoice pelunasan sekarang lebih rapi, termasuk form pelunasan publik, invoice final, dan aksi WhatsApp khusus pelunasan.',
      'new',
      '2026-03-13T16:40:00Z'
    ),
    (
      '1.5.3',
      'Bukti Bayar via Google Drive',
      'Upload bukti pembayaran booking dan pelunasan sekarang tersimpan ke Google Drive admin, lengkap dengan tampilan proof yang lebih aman di detail booking.',
      'improvement',
      '2026-03-13T16:35:00Z'
    ),
    (
      '1.5.3',
      'Form Booking dan Pelunasan Lebih Konsisten',
      'Tampilan metode pembayaran, info rekening, upload file, dan pengaturan add-on kini lebih seragam antara form booking dan form pelunasan.',
      'improvement',
      '2026-03-13T16:30:00Z'
    ),
    (
      '1.5.3',
      'Kolom Aksi Tabel Lebih Ringkas',
      'Kolom aksi di halaman admin kini tetap rapi dengan ikon satu baris, header putih, dan jarak antartombol yang lebih padat tanpa mode sticky kanan.',
      'fix',
      '2026-03-13T16:25:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog
  WHERE version = '1.5.3'
);
