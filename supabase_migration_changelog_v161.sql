-- ============================================================
-- MIGRATION: Changelog v1.6.1
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
      '1.6.1',
      'Pengumuman Libur Lebaran Tampil Global',
      'Sekarang ada bar pengumuman libur Lebaran yang tampil otomatis di halaman umum. Kalau teks kepanjangan, tulisannya berjalan terus dengan halus supaya tetap kebaca.',
      'new',
      '2026-03-19T10:00:00Z'
    ),
    (
      '1.6.1',
      'Pengumuman Tidak Lagi Menutupi Header',
      'Posisi pengumuman dan header publik sudah dirapikan, jadi logo dan menu di atas tidak ketiban lagi saat dibuka atau di-scroll.',
      'fix',
      '2026-03-19T10:01:00Z'
    ),
    (
      '1.6.1',
      'Header Publik Ikut Menyesuaikan Kondisi Login',
      'Di landing, pricing, features, FAQ, ToS, dan privacy, header sekarang bisa menyesuaikan: kalau belum login tampil tombol login, kalau sudah login tampil avatar dan menu akun.',
      'improvement',
      '2026-03-19T10:02:00Z'
    ),
    (
      '1.6.1',
      'Logo Publik Lebih Stabil',
      'Masalah logo Client Desk yang kadang gagal tampil di halaman publik sudah dibenahi, jadi tampilannya lebih konsisten.',
      'fix',
      '2026-03-19T10:03:00Z'
    ),
    (
      '1.6.1',
      'Rincian Invoice Lebih Bersih Saat Nilai Nol',
      'Baris Akomodasi dan Diskon sekarang otomatis disembunyikan kalau nilainya 0, baik di invoice awal maupun final, termasuk tampilan klien dan PDF.',
      'improvement',
      '2026-03-19T10:04:00Z'
    ),
    (
      '1.6.1',
      'Catatan Admin Ditambahkan untuk Internal Tim',
      'Sekarang tersedia Catatan Admin khusus internal di alur booking, jadi admin bisa menyimpan info penting tanpa ikut terlihat ke klien atau freelance.',
      'new',
      '2026-03-19T10:05:00Z'
    ),
    (
      '1.6.1',
      'Tanggal Invoice Mengikuti Tanggal Booking',
      'Tanggal di bagian header invoice sekarang memakai tanggal booking agar konsisten dengan data utama pemesanan.',
      'fix',
      '2026-03-19T10:06:00Z'
    ),
    (
      '1.6.1',
      'Form Pelunasan Final Lebih Fleksibel',
      'Klien sekarang bisa mengirim pelunasan final selama masih ada sisa tagihan, tanpa menunggu langkah tambahan dari admin.',
      'improvement',
      '2026-03-19T10:07:00Z'
    ),
    (
      '1.6.1',
      'Template WhatsApp Wedding Punya Variabel Maps Resepsi',
      'Template pesan WhatsApp untuk event wedding sekarang punya variabel link maps resepsi, jadi info lokasi resepsi bisa dikirim lebih cepat.',
      'new',
      '2026-03-19T10:08:00Z'
    ),
    (
      '1.6.1',
      'Mode Manual Fastpik Kini Benar-Benar Manual',
      'Saat mode sinkronisasi Fastpik diatur manual, project tidak akan otomatis terbentuk dari proses background. Admin tetap bisa sync sendiri saat dibutuhkan.',
      'fix',
      '2026-03-19T10:09:00Z'
    ),
    (
      '1.6.1',
      'Halaman Keuangan Punya Search dan Filter Baru',
      'Halaman keuangan sekarang punya pencarian cepat plus filter paket dan status booking. Tampilan mobile juga dirapikan: tombol aksi dibuat full-width dan urutannya lebih nyaman dipakai.',
      'improvement',
      '2026-03-19T10:10:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog
  WHERE version = '1.6.1'
);
