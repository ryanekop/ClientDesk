-- ============================================================
-- MIGRATION: Changelog v1.6.7 (Bahasa User Awam, Per Poin)
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
      '1.6.7',
      'Role & Tag sekarang bisa dikasih warna',
      'Di menu Tim/Freelance, Anda sekarang bisa atur warna role dan tag supaya lebih cepat dibedakan.',
      'new',
      '2026-04-05T10:20:00Z'
    ),
    (
      '1.6.7',
      'Satu warna berlaku untuk label yang sama',
      'Kalau role atau tag-nya sama, warnanya akan otomatis sama di semua anggota tim.',
      'improvement',
      '2026-04-05T10:21:00Z'
    ),
    (
      '1.6.7',
      'Bisa hapus bukti pembayaran dari detail booking',
      'Admin sekarang bisa hapus bukti pembayaran awal maupun bukti pelunasan final langsung dari halaman detail booking.',
      'new',
      '2026-04-05T10:22:00Z'
    ),
    (
      '1.6.7',
      'Ada pop-up konfirmasi sebelum hapus bukti',
      'Saat klik hapus bukti pembayaran, sistem akan minta konfirmasi dulu agar tidak terhapus tidak sengaja.',
      'improvement',
      '2026-04-05T10:23:00Z'
    ),
    (
      '1.6.7',
      'Pricelist tim sekarang lebih simpel',
      'Format pricelist di Tim/Freelance sekarang cukup Item + Harga, jadi lebih mudah diisi.',
      'improvement',
      '2026-04-05T10:24:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog c
  WHERE c.version = entry.version
    AND c.published_at = entry.published_at::timestamptz
);
