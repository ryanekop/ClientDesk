-- ============================================================
-- MIGRATION: Changelog v1.7.0 (User Friendly, Add + Update)
-- Catatan:
-- - Tidak menghapus data changelog yang sudah ada.
-- - Jika poin v1.7.0 sudah ada (version + published_at sama), akan di-update.
-- - Jika belum ada, akan di-insert.
-- ============================================================

WITH entries(version, title, description, badge, published_at) AS (
  VALUES
    (
      '1.7.0',
      'Informasi Klien di Detail Booking sekarang lebih bersih',
      'Field teknis internal seperti fastpik_project tidak ditampilkan lagi di bagian Informasi Klien, jadi tampilan lebih rapi dan mudah dibaca.',
      'fix',
      '2026-04-06T15:20:00Z'
    ),
    (
      '1.7.0',
      'Data Fastpik tetap aman dipakai sistem',
      'Perubahan ini hanya merapikan tampilan. Data internal Fastpik tetap tersimpan dan tetap dipakai untuk proses sinkronisasi.',
      'improvement',
      '2026-04-06T15:21:00Z'
    ),
    (
      '1.7.0',
      'Kolom metadata internal tidak muncul sebagai kolom tambahan',
      'Di daftar booking, data internal seperti fastpik_project tidak ikut terbaca sebagai metadata umum, jadi pilihan kolom lebih relevan.',
      'improvement',
      '2026-04-06T15:22:00Z'
    ),
    (
      '1.7.0',
      'Form booking publik sekarang jadi 4 langkah',
      'Alur booking sekarang lebih jelas: Informasi Klien, Pilih Paket & Add-on, Ringkasan, lalu Pembayaran & Konfirmasi.',
      'new',
      '2026-04-06T15:23:00Z'
    ),
    (
      '1.7.0',
      'Navigasi langkah booking sekarang lebih terarah',
      'User hanya bisa lanjut kalau data wajib di langkah sebelumnya sudah lengkap, jadi kesalahan input bisa dikurangi dari awal.',
      'improvement',
      '2026-04-06T15:24:00Z'
    ),
    (
      '1.7.0',
      'Ringkasan booking sekarang tampil lebih rapi dan lengkap',
      'Ringkasan diubah ke format teks vertikal yang mudah dibaca, termasuk data klien, sesi, paket, add-on, extra field, dan custom field yang sudah diisi.',
      'improvement',
      '2026-04-06T15:25:00Z'
    ),
    (
      '1.7.0',
      'Tanggal, jam, dan lokasi sesi di ringkasan sudah lebih jelas',
      'Untuk mode split Wedding/Wisuda, ringkasan sekarang menampilkan detail per sesi (tanggal, jam, lokasi) secara terpisah dan lebih mudah dipahami.',
      'fix',
      '2026-04-06T15:26:00Z'
    ),
    (
      '1.7.0',
      'Rincian biaya di Ringkasan sekarang wajib tampil',
      'Di langkah Ringkasan, nominal biaya selalu ditampilkan seperti invoice: paket, add-on, subtotal, akomodasi, diskon, dan total akhir.',
      'new',
      '2026-04-06T15:27:00Z'
    ),
    (
      '1.7.0',
      'Harga tetap bisa disembunyikan di langkah pilih paket',
      'Jika pengaturan hide price aktif, harga tetap disembunyikan di langkah pemilihan paket, tapi tetap muncul lengkap di Ringkasan sebelum konfirmasi.',
      'improvement',
      '2026-04-06T15:28:00Z'
    ),
    (
      '1.7.0',
      'Tampilan form booking desktop sekarang lebih lebar',
      'Lebar form publik di desktop diperluas agar stepper dan isi form lebih nyaman dilihat, tanpa mengubah tampilan mobile.',
      'improvement',
      '2026-04-06T15:29:00Z'
    ),
    (
      '1.7.0',
      'Sebelum pilih tipe acara, form sekarang lebih fokus',
      'Sebelum user memilih Tipe Acara, yang tampil hanya Nama, WhatsApp, dan Tipe Acara. Field lain otomatis muncul setelah tipe acara dipilih.',
      'improvement',
      '2026-04-06T15:30:00Z'
    ),
    (
      '1.7.0',
      'Custom Form Builder sekarang punya picker Tambah Field yang lebih jelas',
      'Popup Tambah Field sekarang menampilkan pilihan jenis custom field langsung (teks, teks panjang, angka, dropdown, checkbox) dan katalog field bawaan lintas acara.',
      'new',
      '2026-04-06T15:31:00Z'
    ),
    (
      '1.7.0',
      'Field di builder sekarang lebih fleksibel diatur',
      'Field bawaan/custom sekarang bisa rename label, tambah deskripsi, hide/show lewat ikon mata, dan tetap menjaga field penting agar tidak bisa disembunyikan.',
      'improvement',
      '2026-04-06T15:32:00Z'
    ),
    (
      '1.7.0',
      'Field bawaan lintas acara sekarang bisa dihapus per event',
      'Field bawaan yang ditambahkan dari acara lain sekarang bisa dihapus lewat ikon trash. Jika dihapus, field akan kembali muncul di picker sebagai belum dipakai.',
      'new',
      '2026-04-06T15:33:00Z'
    ),
    (
      '1.7.0',
      'Batch booking sekarang mendukung mode paste dari spreadsheet',
      'Proses input massal sekarang bisa langsung paste baris dari Excel/Google Sheets, tetap ada preview, validasi, dan hasil import seperti alur sebelumnya.',
      'new',
      '2026-04-06T15:34:00Z'
    )
),
updated AS (
  UPDATE changelog c
  SET
    title = e.title,
    description = e.description,
    badge = e.badge
  FROM entries e
  WHERE c.version = e.version
    AND c.published_at = e.published_at::timestamptz
  RETURNING c.version, c.published_at
)
INSERT INTO changelog (version, title, description, badge, published_at)
SELECT
  e.version,
  e.title,
  e.description,
  e.badge,
  e.published_at::timestamptz
FROM entries e
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog c
  WHERE c.version = e.version
    AND c.published_at = e.published_at::timestamptz
);
