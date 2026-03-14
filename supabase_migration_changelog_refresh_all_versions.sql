-- ============================================================
-- REFRESH: Changelog copy for all existing versions
-- Jalankan file ini untuk merapikan judul dan deskripsi changelog
-- agar bahasanya lebih umum, ringan, dan tidak terlalu teknis.
-- ============================================================

WITH entries(version, title, description, badge, published_at) AS (
  VALUES
    ('1.5.0', 'Form Booking Lebih Fleksibel', 'Sekarang form booking bisa disusun lebih bebas sesuai kebutuhan, termasuk menambah bagian dan isian sendiri.', 'new', '2026-03-12T10:00:00Z'),
    ('1.5.0', 'Jenis Acara Bisa Ditambah Sendiri', 'Sekarang Anda bisa menambahkan jenis acara sendiri agar pilihan acara lebih sesuai dengan kebutuhan usaha.', 'new', '2026-03-12T09:55:00Z'),
    ('1.5.0', 'Paket Tambahan Lebih Rapi', 'Paket tambahan kini bisa ditampilkan terpisah dari paket utama agar pilihan layanan lebih jelas untuk klien.', 'new', '2026-03-12T09:50:00Z'),
    ('1.5.0', 'Urutan Paket Bisa Diatur', 'Posisi paket di form booking sekarang bisa diatur agar paket yang paling penting tampil lebih dulu.', 'improvement', '2026-03-12T09:45:00Z'),
    ('1.5.0', 'Aturan Minimum DP Lebih Fleksibel', 'Minimum DP sekarang bisa disesuaikan agar lebih pas dengan cara kerja masing-masing usaha.', 'improvement', '2026-03-12T09:40:00Z'),
    ('1.5.0', 'Ringkasan Pemasukan Lebih Akurat', 'Perhitungan pemasukan kini lebih sesuai dengan pembayaran yang benar-benar sudah masuk.', 'fix', '2026-03-12T09:35:00Z'),

    ('1.5.1', 'Info Pembaruan Muncul di Dashboard', 'Ringkasan pembaruan terbaru sekarang langsung muncul saat membuka dashboard.', 'new', '2026-03-13T09:00:00Z'),
    ('1.5.1', 'Riwayat Pembaruan Lebih Lengkap', 'Sekarang tersedia halaman khusus untuk melihat daftar perubahan dari versi lama sampai terbaru.', 'new', '2026-03-13T08:55:00Z'),
    ('1.5.1', 'Preferensi Popup Lebih Praktis', 'Pilihan untuk menyembunyikan popup pembaruan sekarang tersimpan lebih praktis di perangkat yang dipakai.', 'improvement', '2026-03-13T08:50:00Z'),
    ('1.5.1', 'Tampilan Log Perubahan Lebih Nyaman', 'Ukuran teks dan susunan tampilannya dirapikan supaya lebih enak dibaca.', 'improvement', '2026-03-13T08:45:00Z'),
    ('1.5.1', 'Tampilan Checkbox Lebih Serasi', 'Tampilan checkbox sekarang lebih selaras dengan tema aplikasi.', 'fix', '2026-03-13T08:40:00Z'),
    ('1.5.1', 'Kemunculan Popup Lebih Sesuai', 'Popup pembaruan kini tampil lebih konsisten sesuai pilihan yang sudah dipilih.', 'fix', '2026-03-13T08:35:00Z'),

    ('1.5.2', 'Pesan ke Freelance Lebih Lengkap', 'Pesan untuk freelance sekarang bisa menampilkan informasi waktu sesi dengan lebih jelas.', 'improvement', '2026-03-13T10:00:00Z'),
    ('1.5.2', 'Nama Jadwal dan Folder Lebih Fleksibel', 'Penamaan jadwal dan folder sekarang bisa dibedakan sesuai jenis acara agar lebih rapi.', 'new', '2026-03-13T09:55:00Z'),
    ('1.5.2', 'Pengaturan Nama Lebih Mudah Dicek', 'Sekarang ada preview hasil dan pilihan variabel yang lebih mudah dipakai saat mengatur nama jadwal atau folder.', 'improvement', '2026-03-13T09:52:00Z'),
    ('1.5.2', 'Metode Pembayaran Lebih Rapi', 'Pilihan metode pembayaran kini tampil lebih lega dan lebih mudah dipilih.', 'improvement', '2026-03-13T09:51:00Z'),
    ('1.5.2', 'Jadwal Lebih Sesuai', 'Waktu acara sekarang tampil lebih sesuai dengan jadwal yang diinput.', 'fix', '2026-03-13T09:50:00Z'),
    ('1.5.2', 'Informasi Tambahan Bisa Muncul di Jadwal', 'Informasi tambahan sesuai jenis acara sekarang bisa ikut tampil di nama jadwal.', 'improvement', '2026-03-13T10:05:00Z'),
    ('1.5.2', 'Atur Urutan Paket Lebih Cepat', 'Paket sekarang bisa disusun ulang dengan cara yang lebih cepat dan nyaman.', 'improvement', '2026-03-13T10:15:00Z'),
    ('1.5.2', 'Daftar Paket Lebih Jelas', 'Paket utama dan paket tambahan sekarang ditampilkan lebih terpisah agar lebih mudah dibaca.', 'improvement', '2026-03-13T10:14:00Z'),
    ('1.5.2', 'Syarat Booking Bisa Ditampilkan', 'Form booking sekarang bisa menampilkan persetujuan syarat sebelum klien mengirim data.', 'new', '2026-03-13T10:10:00Z'),
    ('1.5.2', 'Tampilan Syarat Lebih Nyaman', 'Isi syarat dan ketentuan kini bisa ditata lebih rapi agar lebih mudah dibaca.', 'improvement', '2026-03-13T10:08:00Z'),
    ('1.5.2', 'Pengaturan Syarat Lebih Praktis', 'Letak dan proses pengaturan syarat kini dibuat lebih mudah dipakai.', 'fix', '2026-03-13T10:06:00Z'),

    ('1.5.3', 'Proses Pelunasan Lebih Rapi', 'Alur invoice awal dan pelunasan akhir sekarang dibuat lebih jelas dan lebih nyaman dipakai.', 'new', '2026-03-13T16:40:00Z'),
    ('1.5.3', 'Bukti Pembayaran Lebih Tertata', 'Bukti pembayaran sekarang tersimpan lebih rapi dan lebih mudah dicek.', 'improvement', '2026-03-13T16:35:00Z'),
    ('1.5.3', 'Form Booking dan Pelunasan Lebih Seragam', 'Tampilan dan susunan informasi di form booking dan pelunasan sekarang terasa lebih selaras.', 'improvement', '2026-03-13T16:30:00Z'),
    ('1.5.3', 'Tombol Aksi Tabel Lebih Ringkas', 'Tombol aksi di tabel sekarang terlihat lebih rapi dan lebih nyaman dipakai.', 'fix', '2026-03-13T16:25:00Z'),

    ('1.5.4', 'Filter dan Urutan Booking Lebih Lengkap', 'Daftar booking sekarang punya pilihan filter dan urutan yang lebih lengkap agar data lebih mudah dicari.', 'new', '2026-03-13T18:10:00Z'),
    ('1.5.4', 'Booking Bisa Pilih Lebih dari Satu Paket Utama', 'Satu booking sekarang bisa memuat beberapa paket utama agar lebih fleksibel.', 'new', '2026-03-13T18:05:00Z'),
    ('1.5.4', 'Susunan Folder Klien Lebih Rapi', 'Folder klien sekarang bisa disusun lebih bertingkat agar file lebih mudah dicari.', 'improvement', '2026-03-13T18:00:00Z'),
    ('1.5.4', 'Kolom Tabel Bisa Diatur', 'Kolom yang tampil di beberapa halaman utama sekarang bisa disesuaikan.', 'improvement', '2026-03-13T17:55:00Z'),
    ('1.5.4', 'Tampilan Preview dan Tombol Aksi Lebih Rapi', 'Beberapa bagian tampilan dirapikan supaya lebih enak dilihat dan lebih nyaman dipakai.', 'fix', '2026-03-13T17:50:00Z'),
    ('1.5.4', 'Pesan ke Freelance Lebih Lengkap Lagi', 'Informasi tambahan sesuai acara sekarang bisa muncul lagi saat membuat pesan untuk freelance.', 'fix', '2026-03-13T17:45:00Z'),

    ('1.5.5', 'Kolom Tambahan dari Data Booking', 'Beberapa data tambahan booking sekarang bisa ditampilkan sebagai kolom di tabel.', 'new', '2026-03-13T19:05:00Z'),
    ('1.5.5', 'Urutan Kolom Sesuai Pengaturan', 'Urutan kolom sekarang mengikuti susunan yang dipilih dengan lebih konsisten.', 'improvement', '2026-03-13T19:00:00Z'),
    ('1.5.5', 'Nama Paket Lebih Konsisten', 'Tampilan nama paket kini lebih seragam di beberapa halaman utama.', 'fix', '2026-03-13T18:55:00Z'),

    ('1.5.6', 'Halaman Booking Lebih Stabil', 'Bagian booking kini berjalan lebih stabil di beberapa halaman utama.', 'fix', '2026-03-13T20:10:00Z'),
    ('1.5.6', 'Halaman Pengaturan Lebih Ringan', 'Halaman pengaturan kini terasa lebih aman dan stabil saat dibuka.', 'fix', '2026-03-13T20:05:00Z'),
    ('1.5.6', 'Pengaturan Kolom Lebih Aman Saat Dimuat', 'Pilihan kolom yang sudah disimpan sekarang lebih aman saat dibuka kembali.', 'improvement', '2026-03-13T20:00:00Z'),

    ('1.5.7', 'Tabel Kolom Tambahan Sudah Lebih Stabil', 'Tabel di daftar booking, status booking, dan keuangan sekarang lebih stabil saat menampilkan kolom tambahan.', 'fix', '2026-03-13T20:40:00Z'),
    ('1.5.7', 'Kelola Kolom Lebih Nyaman Dipakai', 'Fitur atur kolom sekarang lebih nyaman dipakai tanpa membuat halaman mudah bermasalah.', 'fix', '2026-03-13T20:35:00Z')
),
updated AS (
  UPDATE changelog AS c
  SET
    title = e.title,
    description = e.description,
    badge = e.badge
  FROM entries AS e
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
FROM entries AS e
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog AS c
  WHERE c.version = e.version
    AND c.published_at = e.published_at::timestamptz
);
