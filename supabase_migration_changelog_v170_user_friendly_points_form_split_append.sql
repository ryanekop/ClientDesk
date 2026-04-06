-- ============================================================
-- MIGRATION: Changelog v1.7.0 (Tambahan Poin Form Split)
-- Catatan:
-- - Tidak menghapus changelog yang sudah ada.
-- - Hanya menambah poin baru jika belum ada.
-- - Bahasa dibuat sederhana agar mudah dipahami user awam.
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
      '1.7.0',
      'Wedding dan Wisuda sekarang punya 2 template: Normal dan Split',
      'Di Custom Form, khusus acara Wedding dan Wisuda sekarang tersedia mode template terpisah: Normal dan Split. Keduanya bisa diatur sendiri.',
      'new',
      '2026-04-06T15:35:00Z'
    ),
    (
      '1.7.0',
      'Template Split sekarang benar-benar terpisah dari Normal',
      'Perubahan di template Split tidak menimpa template Normal. Jadi pengaturan tiap mode bisa berbeda sesuai kebutuhan.',
      'improvement',
      '2026-04-06T15:36:00Z'
    ),
    (
      '1.7.0',
      'Toggle split Wedding/Wisuda tetap jadi kontrol utama',
      'Jika toggle split dimatikan oleh vendor, user tidak bisa memilih alur split di form publik. Sistem otomatis pakai alur normal.',
      'fix',
      '2026-04-06T15:37:00Z'
    ),
    (
      '1.7.0',
      'Urutan field Wedding sudah dirapikan untuk mode Normal dan Split',
      'Posisi field seperti switch split, jadwal, detail lokasi, nama pasangan, Instagram pasangan, dan estimasi tamu sekarang mengikuti urutan final yang diminta.',
      'fix',
      '2026-04-06T15:38:00Z'
    ),
    (
      '1.7.0',
      'Urutan field Wisuda sudah dirapikan untuk mode Normal dan Split',
      'Field sesi wisuda, lokasi sesi, universitas, dan fakultas sekarang tampil di urutan yang lebih konsisten dan mudah diisi.',
      'fix',
      '2026-04-06T15:39:00Z'
    ),
    (
      '1.7.0',
      'Saat split aktif, lokasi utama disembunyikan dan diganti lokasi per sesi',
      'Untuk Wedding/Wisuda mode split, field Lokasi utama tidak ditampilkan agar user fokus ke lokasi sesi yang relevan.',
      'improvement',
      '2026-04-06T15:40:00Z'
    ),
    (
      '1.7.0',
      'Navigasi langkah form sekarang lebih nyaman',
      'Setelah pindah langkah (Next/Back/klik step) dan valid, tampilan otomatis kembali ke bagian atas form agar lebih mudah lanjut isi.',
      'improvement',
      '2026-04-06T15:41:00Z'
    ),
    (
      '1.7.0',
      'Validasi sekarang langsung mengarahkan ke field wajib yang belum diisi',
      'Jika ada data wajib yang kosong, form tidak lanjut ke langkah berikutnya dan langsung lompat ke field pertama yang perlu diisi.',
      'fix',
      '2026-04-06T15:42:00Z'
    ),
    (
      '1.7.0',
      'Instagram tetap tampil sebelum user memilih tipe acara',
      'Field Instagram sekarang tetap terlihat dari awal, jadi user bisa isi lebih cepat tanpa menunggu pilih tipe acara.',
      'improvement',
      '2026-04-06T15:43:00Z'
    ),
    (
      '1.7.0',
      'Ringkasan booking dibuat lebih rapi untuk data tambahan',
      'Bagian Extra Field dan Custom Field sekarang digabung ke Detail Sesi dengan label Extra, plus garis pemisah antarbagian agar lebih jelas.',
      'improvement',
      '2026-04-06T15:44:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog c
  WHERE c.version = entry.version
    AND c.published_at = entry.published_at::timestamptz
);
