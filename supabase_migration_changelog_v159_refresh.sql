-- ============================================================
-- REFRESH: Changelog v1.5.8 + v1.5.9 (awam-menengah, detail)
-- Jalankan file ini di Supabase SQL Editor untuk:
-- 1) Menghapus entri lama versi 1.5.8 dan 1.5.9
-- 2) Mengisi ulang dengan copy terbaru
-- ============================================================

BEGIN;

DELETE FROM changelog
WHERE version IN ('1.5.8', '1.5.9');

INSERT INTO changelog (version, title, description, badge, published_at)
VALUES
  ('1.5.8', 'Pengaturan Fastpik Lebih Lengkap', 'Area Fastpik sekarang lebih jelas di pengaturan, jadi Anda bisa melihat status koneksi, memilih cara sinkronisasi, mengatur sumber preset, dan mengecek hasil sinkron terakhir dengan lebih mudah.', 'new', '2026-03-17T20:05:00Z'::timestamptz),
  ('1.5.8', 'Sinkronisasi Booking ke Fastpik Lebih Praktis', 'Sinkronisasi sekarang bisa dijalankan manual saat diperlukan, atau otomatis setelah data booking diperbarui. Ini membantu alur kerja jadi lebih cepat tanpa harus cek satu per satu.', 'new', '2026-03-17T20:06:00Z'::timestamptz),
  ('1.5.8', 'Link Hasil Foto Lebih Jelas', 'Di halaman detail booking dan tracking, link Fastpik sekarang ditampilkan sebagai pilihan utama. Link Google Drive tetap tersedia sebagai cadangan bila dibutuhkan.', 'improvement', '2026-03-17T20:07:00Z'::timestamptz),
  ('1.5.8', 'Proses Sinkronisasi Lebih Stabil', 'Proses sinkronisasi dibuat lebih tahan saat koneksi kurang stabil. Status sinkron juga lebih mudah dipantau, jadi Anda bisa cepat tahu kalau ada data yang belum sinkron.', 'fix', '2026-03-17T20:08:00Z'::timestamptz),
  ('1.5.8', 'Jenis Acara Custom/Lainnya Disatukan', 'Pilihan jenis acara Custom/Lainnya sekarang disatukan agar tidak membingungkan dan tidak muncul ganda di halaman pengaturan maupun form booking.', 'improvement', '2026-03-17T20:09:00Z'::timestamptz),
  ('1.5.8', 'Pilihan Paket Lebih Lengkap untuk Custom/Lainnya', 'Saat memilih jenis acara Custom/Lainnya, daftar paket utama dan add-on aktif tetap tampil lebih lengkap supaya pilihan layanan tidak terasa terbatas.', 'improvement', '2026-03-17T20:10:00Z'::timestamptz),
  ('1.5.8', 'Data Jenis Acara Lama Dirapikan Otomatis', 'Data jenis acara lama dengan nama sebelumnya ikut dirapikan otomatis agar data lama dan data baru tetap konsisten saat dilihat di berbagai halaman.', 'fix', '2026-03-17T20:11:00Z'::timestamptz),

  ('1.5.9', 'Form Booking Khusus untuk Klien Tertentu', 'Sekarang Anda bisa membuat link form booking khusus untuk kebutuhan tertentu, misalnya klien luar kota, acara khusus, atau skema harga yang berbeda dari booking biasa.', 'new', '2026-03-18T12:10:00Z'::timestamptz),
  ('1.5.9', 'Lock/Unlock Jenis Acara, Paket, dan Add-on', 'Di form booking khusus, admin sekarang bisa mengunci atau membebaskan pilihan Jenis Acara, Paket, dan Add-on sesuai skenario layanan yang diinginkan.', 'new', '2026-03-18T12:11:00Z'::timestamptz),
  ('1.5.9', 'Rincian Harga Awal Lebih Transparan', 'Perhitungan harga awal sekarang lebih jelas karena komponen paket, add-on, akomodasi, dan diskon ditampilkan lebih rapi dan mudah dipahami.', 'improvement', '2026-03-18T12:12:00Z'::timestamptz),
  ('1.5.9', 'Data Keuangan, Invoice, dan Tracking Lebih Sinkron', 'Perhitungan total, sisa pembayaran, dan ringkasan harga sekarang lebih konsisten di halaman Detail Booking, Keuangan, Tracking, dan Invoice.', 'improvement', '2026-03-18T12:13:00Z'::timestamptz),
  ('1.5.9', 'Tampilan Invoice Lebih Jelas untuk Add-on', 'Bagian layanan dan add-on pada invoice dibuat lebih jelas pemisahannya supaya nilai subtotal dan item layanan lebih mudah dibaca oleh klien.', 'improvement', '2026-03-18T12:14:00Z'::timestamptz),
  ('1.5.9', 'Notifikasi Sukses dan Salin Link Lebih Seragam', 'Notifikasi berhasil simpan dan salin link sekarang tampil dengan gaya yang lebih konsisten di beberapa halaman utama agar pengalaman penggunaan lebih nyaman.', 'improvement', '2026-03-18T12:15:00Z'::timestamptz),
  ('1.5.9', 'Status Progress Klien Lebih Aman', 'Urutan status progress klien sekarang lebih terjaga: Pending tetap di awal dan Selesai tetap di akhir, sehingga alur tracking lebih rapi.', 'fix', '2026-03-18T12:16:00Z'::timestamptz),
  ('1.5.9', 'Kirim Invoice Final Lebih Stabil', 'Proses kirim invoice final ke WhatsApp diperbaiki agar lebih stabil dan tidak membuka tab ganda saat tombol diklik.', 'fix', '2026-03-18T12:17:00Z'::timestamptz);

COMMIT;
