-- ============================================================
-- MIGRATION: Changelog v1.8.6 (Lokasi Google Calendar & Link Telegram)
-- Catatan:
-- - Append: tidak menghapus changelog yang sudah ada.
-- - Hanya menambah poin baru jika belum ada.
-- - Bahasa dibuat singkat, per poin, dan mudah dipahami user awam.
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
      '1.8.6',
      'Lokasi Google Calendar lebih jelas',
      'Lokasi booking sekarang masuk ke kolom lokasi Google Calendar, bukan hanya di deskripsi.',
      'improvement',
      '2026-05-02T09:00:00Z'
    ),
    (
      '1.8.6',
      'Link Maps tetap tersedia',
      'Deskripsi event tetap menyimpan link Maps agar alamat mudah dibuka saat dibutuhkan.',
      'improvement',
      '2026-05-02T09:01:00Z'
    ),
    (
      '1.8.6',
      'Lokasi sesi lebih akurat',
      'Booking dengan beberapa sesi memakai lokasi masing-masing sesi saat disinkronkan ke Google Calendar.',
      'fix',
      '2026-05-02T09:02:00Z'
    ),
    (
      '1.8.6',
      'Event lama ikut diperbarui',
      'Saat booking disinkronkan ulang, event Google Calendar yang sudah ada ikut mendapat lokasi terbaru.',
      'improvement',
      '2026-05-02T09:03:00Z'
    ),
    (
      '1.8.6',
      'Link Telegram ikut domain studio',
      'Link Detail Booking di notifikasi Telegram sekarang memakai domain tenant yang tersambung.',
      'improvement',
      '2026-05-02T09:04:00Z'
    ),
    (
      '1.8.6',
      'Reminder Telegram lebih sesuai',
      'Link tracking dan Detail Booking di reminder H-1 ikut memakai domain tenant.',
      'improvement',
      '2026-05-02T09:05:00Z'
    ),
    (
      '1.8.6',
      'Akun tanpa domain tetap aman',
      'Jika tenant belum punya domain, link Telegram tetap memakai link ClientDesk seperti sebelumnya.',
      'fix',
      '2026-05-02T09:06:00Z'
    ),
    (
      '1.8.6',
      'Pembayaran tim bisa dicicil',
      'Admin bisa mengisi DP pembayaran tim, lalu sisa yang belum dibayar dihitung otomatis.',
      'improvement',
      '2026-05-02T09:07:00Z'
    ),
    (
      '1.8.6',
      'Tanggal bayar bisa diedit',
      'Tanggal pelunasan pembayaran tim bisa diatur manual saat mengedit pembayaran.',
      'improvement',
      '2026-05-02T09:08:00Z'
    ),
    (
      '1.8.6',
      'Sisa pembayaran lebih mudah dilihat',
      'Kolom Belum Bayar diberi warna agar sisa pembayaran tim lebih cepat terbaca.',
      'improvement',
      '2026-05-02T09:09:00Z'
    ),
    (
      '1.8.6',
      'Pembayaran tim bisa dihapus manual',
      'Jika ada data pembayaran yang nyangkut, admin bisa menghapusnya setelah konfirmasi.',
      'improvement',
      '2026-05-02T09:10:00Z'
    ),
    (
      '1.8.6',
      'Freelance dilepas ikut bersih',
      'Saat freelance dihapus dari booking, data pembayaran tim terkait ikut dibersihkan.',
      'fix',
      '2026-05-02T09:11:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog c
  WHERE c.version = entry.version
    AND c.published_at = entry.published_at::timestamptz
);
