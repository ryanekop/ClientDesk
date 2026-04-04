-- ============================================================
-- MIGRATION: Changelog v1.6.6 (track status client fix)
-- Run this SQL in Supabase SQL Editor
-- Catatan: aman dijalankan ulang, tidak akan membuat duplikat.
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
      'Halaman Status Klien Sekarang Bersih dari Pesan Error Teknis',
      'Pesan teknis yang sempat muncul di halaman status klien sudah dibersihkan, jadi tampilan lebih rapi dan tidak membingungkan klien.',
      'fix',
      '2026-04-04T12:10:00Z'
    ),
    (
      '1.6.6',
      'Data File Hasil Sekarang Tetap Cepat Muncul dan Otomatis Diperbarui',
      'Saat halaman dibuka, data awal tetap langsung tampil. Setelah itu sistem otomatis ambil data terbaru di belakang layar agar info file hasil tetap up to date.',
      'improvement',
      '2026-04-04T12:11:00Z'
    ),
    (
      '1.6.6',
      'Halaman Tetap Aman Walau Sinkronisasi Sedang Bermasalah',
      'Kalau sinkronisasi data sedang gagal atau lambat, halaman tetap bisa dibuka normal dengan data terakhir yang tersedia.',
      'fix',
      '2026-04-04T12:12:00Z'
    ),
    (
      '1.6.6',
      'Login Sekarang Lebih Stabil Saat Pindah Tab',
      'Sesi login sekarang lebih stabil, jadi tidak mudah keluar sendiri saat Anda berpindah tab atau kembali membuka halaman.',
      'fix',
      '2026-04-04T19:40:00Z'
    ),
    (
      '1.6.6',
      'Default Login Dibuat Tetap Tersimpan',
      'Sekarang akun akan tetap tersimpan secara default setelah login, sehingga Anda tidak perlu sering login ulang.',
      'improvement',
      '2026-04-04T19:41:00Z'
    ),
    (
      '1.6.6',
      'Tampilan Paket Tetap Aman Meski Data Langganan Belum Ada',
      'Jika data langganan belum terbentuk, halaman tetap berjalan normal tanpa menampilkan error teknis.',
      'fix',
      '2026-04-04T19:42:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog c
  WHERE c.version = entry.version
    AND c.published_at = entry.published_at::timestamptz
);
