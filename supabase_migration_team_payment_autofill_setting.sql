-- Team payment autofill setting.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS team_payment_autofill_from_operational_costs BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE public.profiles
SET team_payment_autofill_from_operational_costs = TRUE
WHERE team_payment_autofill_from_operational_costs IS NULL;

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
  should_autofill BOOLEAN := TRUE;
BEGIN
  SELECT user_id, operational_costs::jsonb
  INTO booking_owner, booking_operational_costs
  FROM public.bookings
  WHERE id = NEW.booking_id;

  IF booking_owner IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(team_payment_autofill_from_operational_costs, TRUE)
  INTO should_autofill
  FROM public.profiles
  WHERE id = booking_owner;

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
    CASE
      WHEN should_autofill THEN public.cd_match_freelance_operational_cost_amount(
        COALESCE(booking_operational_costs, '[]'::jsonb),
        freelance_name,
        freelance_role
      )
      ELSE 0
    END,
    'unpaid'
  )
  ON CONFLICT (booking_id, freelance_id) DO NOTHING;

  RETURN NEW;
END;
$$;
