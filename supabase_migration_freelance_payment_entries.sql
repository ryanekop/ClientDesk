-- Internal team/freelance payment ledger per booking assignment.
CREATE TABLE IF NOT EXISTS public.freelance_payment_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  freelance_id UUID NOT NULL REFERENCES public.freelance(id) ON DELETE CASCADE,
  amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (booking_id, freelance_id)
);

CREATE INDEX IF NOT EXISTS freelance_payment_entries_user_idx
  ON public.freelance_payment_entries (user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS freelance_payment_entries_booking_idx
  ON public.freelance_payment_entries (booking_id);

CREATE INDEX IF NOT EXISTS freelance_payment_entries_freelance_idx
  ON public.freelance_payment_entries (freelance_id);

ALTER TABLE public.freelance_payment_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "freelance_payment_entries_select_own"
  ON public.freelance_payment_entries;
CREATE POLICY "freelance_payment_entries_select_own"
  ON public.freelance_payment_entries
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "freelance_payment_entries_insert_own"
  ON public.freelance_payment_entries;
CREATE POLICY "freelance_payment_entries_insert_own"
  ON public.freelance_payment_entries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "freelance_payment_entries_update_own"
  ON public.freelance_payment_entries;
CREATE POLICY "freelance_payment_entries_update_own"
  ON public.freelance_payment_entries
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.cd_match_freelance_operational_cost_amount(
  operational_costs JSONB,
  freelance_name TEXT,
  freelance_role TEXT
)
RETURNS NUMERIC
LANGUAGE SQL
IMMUTABLE
AS $$
  WITH needles AS (
    SELECT LOWER(TRIM(value)) AS value
    FROM unnest(ARRAY[
      COALESCE(freelance_name, ''),
      COALESCE(freelance_role, '')
    ]) AS value
    WHERE LENGTH(TRIM(value)) >= 2
  ),
  cost_items AS (
    SELECT
      LOWER(TRIM(COALESCE(item ->> 'label', item ->> 'name', ''))) AS label,
      COALESCE(
        NULLIF(REGEXP_REPLACE(COALESCE(item ->> 'amount', item ->> 'price', '0'), '[^0-9]', '', 'g'), '')::NUMERIC,
        0
      ) AS amount
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(operational_costs) = 'array' THEN operational_costs
        ELSE '[]'::jsonb
      END
    ) AS item
  )
  SELECT COALESCE(SUM(cost_items.amount), 0)
  FROM cost_items
  WHERE EXISTS (
    SELECT 1
    FROM needles
    WHERE cost_items.label LIKE '%' || needles.value || '%'
  );
$$;

INSERT INTO public.freelance_payment_entries (
  user_id,
  booking_id,
  freelance_id,
  amount,
  status
)
SELECT
  bookings.user_id,
  booking_freelance.booking_id,
  booking_freelance.freelance_id,
  public.cd_match_freelance_operational_cost_amount(
    COALESCE(bookings.operational_costs::jsonb, '[]'::jsonb),
    freelance.name,
    freelance.role
  ),
  'unpaid'
FROM public.booking_freelance
JOIN public.bookings
  ON bookings.id = booking_freelance.booking_id
LEFT JOIN public.freelance
  ON freelance.id = booking_freelance.freelance_id
WHERE bookings.user_id IS NOT NULL
ON CONFLICT (booking_id, freelance_id) DO NOTHING;

INSERT INTO public.freelance_payment_entries (
  user_id,
  booking_id,
  freelance_id,
  amount,
  status
)
SELECT
  bookings.user_id,
  bookings.id,
  bookings.freelance_id,
  public.cd_match_freelance_operational_cost_amount(
    COALESCE(bookings.operational_costs::jsonb, '[]'::jsonb),
    freelance.name,
    freelance.role
  ),
  'unpaid'
FROM public.bookings
LEFT JOIN public.freelance
  ON freelance.id = bookings.freelance_id
WHERE bookings.user_id IS NOT NULL
  AND bookings.freelance_id IS NOT NULL
ON CONFLICT (booking_id, freelance_id) DO NOTHING;

UPDATE public.freelance_payment_entries AS entries
SET amount = matched.amount
FROM (
  SELECT
    entries.id,
    public.cd_match_freelance_operational_cost_amount(
      COALESCE(bookings.operational_costs::jsonb, '[]'::jsonb),
      freelance.name,
      freelance.role
    ) AS amount
  FROM public.freelance_payment_entries AS entries
  JOIN public.bookings
    ON bookings.id = entries.booking_id
  JOIN public.freelance
    ON freelance.id = entries.freelance_id
  WHERE entries.amount = 0
    AND entries.status = 'unpaid'
    AND entries.paid_at IS NULL
    AND entries.notes IS NULL
) AS matched
WHERE entries.id = matched.id
  AND matched.amount > 0;

CREATE OR REPLACE FUNCTION public.cd_touch_freelance_payment_entries_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_freelance_payment_entries_touch_updated_at
  ON public.freelance_payment_entries;
CREATE TRIGGER trg_freelance_payment_entries_touch_updated_at
BEFORE UPDATE ON public.freelance_payment_entries
FOR EACH ROW
EXECUTE FUNCTION public.cd_touch_freelance_payment_entries_updated_at();

CREATE OR REPLACE FUNCTION public.cd_ensure_freelance_payment_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  booking_owner UUID;
  booking_operational_costs JSONB;
  freelance_name TEXT;
  freelance_role TEXT;
BEGIN
  SELECT user_id, operational_costs::jsonb
  INTO booking_owner, booking_operational_costs
  FROM public.bookings
  WHERE id = NEW.booking_id;

  IF booking_owner IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name, role
  INTO freelance_name, freelance_role
  FROM public.freelance
  WHERE id = NEW.freelance_id;

  INSERT INTO public.freelance_payment_entries (
    user_id,
    booking_id,
    freelance_id,
    amount,
    status
  )
  VALUES (
    booking_owner,
    NEW.booking_id,
    NEW.freelance_id,
    public.cd_match_freelance_operational_cost_amount(
      COALESCE(booking_operational_costs, '[]'::jsonb),
      freelance_name,
      freelance_role
    ),
    'unpaid'
  )
  ON CONFLICT (booking_id, freelance_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_booking_freelance_ensure_payment_entry
  ON public.booking_freelance;
CREATE TRIGGER trg_booking_freelance_ensure_payment_entry
AFTER INSERT ON public.booking_freelance
FOR EACH ROW
EXECUTE FUNCTION public.cd_ensure_freelance_payment_entry();
