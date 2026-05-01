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
  0,
  'unpaid'
FROM public.booking_freelance
JOIN public.bookings
  ON bookings.id = booking_freelance.booking_id
WHERE bookings.user_id IS NOT NULL
ON CONFLICT (booking_id, freelance_id) DO NOTHING;

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
AS $$
DECLARE
  booking_owner UUID;
BEGIN
  SELECT user_id INTO booking_owner
  FROM public.bookings
  WHERE id = NEW.booking_id;

  IF booking_owner IS NULL THEN
    RETURN NEW;
  END IF;

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
    0,
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
