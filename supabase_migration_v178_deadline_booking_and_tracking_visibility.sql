-- ============================================================
-- MIGRATION: v1.7.8 Deadline Booking + Toggle Tracking
-- ============================================================

-- 1) Kolom deadline per booking
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS project_deadline_date DATE;

-- 2) Rule auto deadline per status (admin)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS client_status_deadline_rules JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3) Toggle global tampilkan deadline ke tracking publik
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tracking_project_deadline_visible BOOLEAN NOT NULL DEFAULT false;

-- 4) Rapikan data lama agar tidak null
UPDATE public.profiles
SET client_status_deadline_rules = '{}'::jsonb
WHERE client_status_deadline_rules IS NULL;

-- ============================================================
-- CHANGELOG v1.7.8 (format sama seperti versi sebelumnya)
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
      '1.7.8',
      'Deadline Project sekarang tersedia di Status Booking',
      'Admin bisa isi atau ubah deadline langsung dari halaman Status Booking dan Detail Booking.',
      'new',
      '2026-04-21T08:00:00Z'
    ),
    (
      '1.7.8',
      'Deadline bisa otomatis dari status tertentu',
      'Setiap status bisa diatur jadi trigger auto deadline, misalnya masuk Antrian Edit otomatis +7 hari.',
      'improvement',
      '2026-04-21T08:01:00Z'
    ),
    (
      '1.7.8',
      'Tampilan deadline di tracking klien sekarang bisa diatur ON/OFF',
      'Ada toggle global di Settings > Status untuk menampilkan deadline ke tracking publik atau tetap admin-only.',
      'improvement',
      '2026-04-21T08:02:00Z'
    )
) AS entry(version, title, description, badge, published_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog c
  WHERE c.version = entry.version
    AND c.published_at = entry.published_at::timestamptz
);
