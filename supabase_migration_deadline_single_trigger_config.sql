-- ============================================================
-- MIGRATION: Simplify Deadline Trigger (Single Status + Default Days)
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS client_status_deadline_rules JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS client_status_deadline_trigger_status TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS client_status_deadline_default_days INTEGER NOT NULL DEFAULT 7;

UPDATE public.profiles
SET client_status_deadline_rules = '{}'::jsonb
WHERE client_status_deadline_rules IS NULL;

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
