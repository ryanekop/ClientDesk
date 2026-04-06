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
      'Pengaturan Fastpik Lebih Lengkap',
      'Area Fastpik sekarang lebih jelas di pengaturan, jadi Anda bisa melihat status koneksi, memilih cara sinkronisasi, mengatur sumber preset, dan mengecek hasil sinkron terakhir dengan lebih mudah.',
      'new',
      '2026-03-17T20:05:00Z'
    ),
    (
      '1.5.8',
      'Sinkronisasi Booking ke Fastpik Lebih Praktis',
      'Sinkronisasi sekarang bisa dijalankan manual saat diperlukan, atau otomatis setelah data booking diperbarui. Ini membantu alur kerja jadi lebih cepat tanpa harus cek satu per satu.',
      'new',
      '2026-03-17T20:06:00Z'
    ),
    (
      '1.5.8',
      'Link Hasil Foto Lebih Jelas',
      'Di halaman detail booking dan tracking, link Fastpik sekarang ditampilkan sebagai pilihan utama. Link Google Drive tetap tersedia sebagai cadangan bila dibutuhkan.',
      'improvement',
      '2026-03-17T20:07:00Z'
    ),
    (
      '1.5.8',
      'Proses Sinkronisasi Lebih Stabil',
      'Proses sinkronisasi dibuat lebih tahan saat koneksi kurang stabil. Status sinkron juga lebih mudah dipantau, jadi Anda bisa cepat tahu kalau ada data yang belum sinkron.',
      'fix',
      '2026-03-17T20:08:00Z'
    ),
    (
      '1.5.8',
      'Jenis Acara Custom/Lainnya Disatukan',
      'Pilihan jenis acara Custom/Lainnya sekarang disatukan agar tidak membingungkan dan tidak muncul ganda di halaman pengaturan maupun form booking.',
      'improvement',
      '2026-03-17T20:09:00Z'
    ),
    (
      '1.5.8',
      'Pilihan Paket Lebih Lengkap untuk Custom/Lainnya',
      'Saat memilih jenis acara Custom/Lainnya, daftar paket utama dan add-on aktif tetap tampil lebih lengkap supaya pilihan layanan tidak terasa terbatas.',
      'improvement',
      '2026-03-17T20:10:00Z'
    ),
    (
      '1.5.8',
      'Data Jenis Acara Lama Dirapikan Otomatis',
      'Data jenis acara lama dengan nama sebelumnya ikut dirapikan otomatis agar data lama dan data baru tetap konsisten saat dilihat di berbagai halaman.',
      'fix',
      '2026-03-17T20:11:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog
  WHERE version = '1.5.8'
);
