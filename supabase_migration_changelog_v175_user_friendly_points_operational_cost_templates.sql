-- ============================================================
-- MIGRATION: Changelog v1.7.5 (Bahasa User Awam, Per Poin)
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
      '1.7.5',
      'Template biaya operasional sekarang bisa disiapkan dari Pengaturan',
      'Admin bisa membuat daftar biaya yang sering dipakai, seperti freelance, transport, editor, atau cetak album, supaya tidak perlu mengetik ulang di setiap booking.',
      'new',
      '2026-04-14T08:00:00Z'
    ),
    (
      '1.7.5',
      'Biaya operasional di booking bisa diisi lewat popup template',
      'Saat edit booking, admin bisa memilih template biaya dengan popup yang lebih cepat, lalu tetap bisa menambah atau mengubah biaya secara manual.',
      'new',
      '2026-04-14T08:01:00Z'
    ),
    (
      '1.7.5',
      'Biaya freelance bisa diambil dari pricelist tim yang sudah ditugaskan',
      'Jika freelance sudah dipilih di booking dan punya pricelist, biayanya akan muncul sebagai pilihan sehingga admin bisa memasukkannya tanpa input ulang.',
      'improvement',
      '2026-04-14T08:02:00Z'
    ),
    (
      '1.7.5',
      'Biaya operasional hanya bisa dilihat dan diubah oleh admin',
      'Data biaya internal dan pemasukan bersih kini dibatasi untuk admin, sehingga staf tetap bisa bekerja tanpa melihat angka margin operasional.',
      'security',
      '2026-04-14T08:03:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog c
  WHERE c.version = entry.version
    AND c.published_at = entry.published_at::timestamptz
);
