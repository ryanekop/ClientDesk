-- ============================================================
-- MIGRATION: Changelog v1.6.8 (Bahasa User Awam, Per Poin)
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
      '1.6.8',
      'Detail Booking sekarang dibagi per tab',
      'Halaman Detail Booking sekarang lebih rapi karena dibagi menjadi 4 tab: Informasi, Keuangan, Hasil Jadi, dan Status Klien.',
      'improvement',
      '2026-04-06T10:00:00Z'
    ),
    (
      '1.6.8',
      'Bukti pembayaran sekarang lebih enak dipakai',
      'Di bukti pembayaran awal dan final, tampilan preview, tombol ganti, dan tombol hapus sekarang berada dalam satu kotak yang sama.',
      'fix',
      '2026-04-06T10:01:00Z'
    ),
    (
      '1.6.8',
      'Antrian edit otomatis dari Detail Booking',
      'Saat status diubah ke Antrian Edit dari halaman Detail Booking, nomor antrian akan otomatis lanjut tanpa isi manual.',
      'new',
      '2026-04-06T10:02:00Z'
    ),
    (
      '1.6.8',
      'Nomor antrian otomatis dirapikan saat status keluar antrian',
      'Saat status diubah keluar dari Antrian Edit, nomor antrian booking tersebut akan dihapus dan urutan antrian lain otomatis dirapikan.',
      'improvement',
      '2026-04-06T10:03:00Z'
    ),
    (
      '1.6.8',
      'Bagian Fastpik muncul lagi di Detail Booking',
      'Tab Hasil Jadi sekarang tetap menampilkan bagian Fastpik, termasuk saat link belum tersedia.',
      'fix',
      '2026-04-06T10:04:00Z'
    ),
    (
      '1.6.8',
      'Template WA konfirmasi booking ke admin sekarang bisa tampil jam sesi',
      'Template WhatsApp konfirmasi booking ke admin sekarang mendukung variabel jam sesi ({{session_time}}) agar isi pesan lebih lengkap.',
      'new',
      '2026-04-06T10:05:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog c
  WHERE c.version = entry.version
    AND c.published_at = entry.published_at::timestamptz
);
