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
    ),
    (
      '1.6.6',
      'Sekarang Bisa Duplikat Paket Lebih Cepat',
      'Di halaman Paket/Layanan sekarang ada tombol Duplikat dengan konfirmasi, jadi Anda bisa copy paket yang mirip tanpa isi ulang dari awal.',
      'new',
      '2026-04-04T10:04:00Z'
    ),
    (
      '1.6.6',
      'Pilih Freelance Sekarang Lebih Mudah Saat Data Banyak',
      'Pemilihan freelance di form booking admin sekarang pakai popup pencarian (mirip pilih paket), jadi lebih cepat meski anggota tim banyak.',
      'improvement',
      '2026-04-04T10:05:00Z'
    ),
    (
      '1.6.6',
      'Role dan Tag Freelance Kini Langsung Terlihat Saat Memilih',
      'Saat memilih freelance, Anda bisa langsung lihat peran dan tag di kartu pilihan, termasuk untuk mode per sesi (split) seperti Wisuda.',
      'improvement',
      '2026-04-04T10:06:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog c
  WHERE c.version = entry.version
    AND c.published_at = entry.published_at::timestamptz
);
