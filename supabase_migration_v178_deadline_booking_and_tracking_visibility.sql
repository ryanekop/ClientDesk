-- ============================================================
-- MIGRATION: v1.7.8 Deadline Booking + Toggle Tracking
-- ============================================================

-- 1) Kolom deadline per booking
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS project_deadline_date DATE;

-- 2) Rule auto deadline per status (admin)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS client_status_deadline_rules JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3) Konfigurasi trigger tunggal deadline (admin)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS client_status_deadline_trigger_status TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS client_status_deadline_default_days INTEGER NOT NULL DEFAULT 7;

-- 4) Toggle global tampilkan deadline ke tracking publik
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tracking_project_deadline_visible BOOLEAN NOT NULL DEFAULT false;

-- 5) Rapikan data lama agar tidak null
UPDATE public.profiles
SET client_status_deadline_rules = '{}'::jsonb
WHERE client_status_deadline_rules IS NULL;

-- 6) Backfill model lama (rules per status) ke model baru (1 trigger + default hari)
WITH active_rules AS (
  SELECT
    p.id,
    s.status AS trigger_status,
    GREATEST(
      COALESCE(
        NULLIF((p.client_status_deadline_rules -> s.status ->> 'days'), '')::INTEGER,
        0
      ),
      1
    ) AS default_days,
    s.ord
  FROM public.profiles p
  CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE
      WHEN jsonb_typeof(p.custom_client_statuses) = 'array'
        THEN p.custom_client_statuses
      ELSE '[]'::jsonb
    END
  ) WITH ORDINALITY AS s(status, ord)
  WHERE COALESCE(
    (p.client_status_deadline_rules -> s.status ->> 'enabled')::BOOLEAN,
    true
  )
    AND COALESCE(
      NULLIF((p.client_status_deadline_rules -> s.status ->> 'days'), '')::INTEGER,
      0
    ) > 0
),
first_active_rule AS (
  SELECT DISTINCT ON (id)
    id,
    trigger_status,
    default_days
  FROM active_rules
  ORDER BY id, ord
)
UPDATE public.profiles p
SET
  client_status_deadline_trigger_status = f.trigger_status,
  client_status_deadline_default_days = f.default_days
FROM first_active_rule f
WHERE p.id = f.id
  AND p.client_status_deadline_trigger_status IS NULL;

UPDATE public.profiles
SET client_status_deadline_default_days = 7
WHERE client_status_deadline_default_days < 1;

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
      'Auto deadline sekarang pakai 1 status trigger + default hari',
      'Di Settings, cukup pilih 1 status trigger deadline dan isi default jumlah hari. Jika status booking masuk ke trigger, deadline dibuat otomatis.',
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
