-- ========================================================
-- Migration: Admin-only operational cost templates
-- ========================================================

BEGIN;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS operational_cost_templates JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.profiles
SET operational_cost_templates = '[]'::jsonb
WHERE operational_cost_templates IS NULL
   OR jsonb_typeof(operational_cost_templates) <> 'array';

CREATE OR REPLACE FUNCTION public.cd_current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND COALESCE(NULLIF(btrim(p.role), ''), '') = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.cd_current_user_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cd_current_user_is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.cd_guard_booking_operational_costs_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.operational_costs, '[]'::jsonb) <> '[]'::jsonb
       AND NOT public.cd_current_user_is_admin() THEN
      RAISE EXCEPTION 'Only admins can set operational costs.';
    END IF;
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.operational_costs, '[]'::jsonb)
     IS DISTINCT FROM COALESCE(OLD.operational_costs, '[]'::jsonb)
     AND NOT public.cd_current_user_is_admin() THEN
    RAISE EXCEPTION 'Only admins can update operational costs.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_booking_operational_costs_admin ON public.bookings;
CREATE TRIGGER trg_guard_booking_operational_costs_admin
BEFORE INSERT OR UPDATE OF operational_costs ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.cd_guard_booking_operational_costs_admin();

CREATE OR REPLACE FUNCTION public.cd_guard_profile_operational_cost_templates_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.operational_cost_templates, '[]'::jsonb) <> '[]'::jsonb
       AND NOT public.cd_current_user_is_admin() THEN
      RAISE EXCEPTION 'Only admins can set operational cost templates.';
    END IF;
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.operational_cost_templates, '[]'::jsonb)
     IS DISTINCT FROM COALESCE(OLD.operational_cost_templates, '[]'::jsonb)
     AND NOT public.cd_current_user_is_admin() THEN
    RAISE EXCEPTION 'Only admins can update operational cost templates.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_operational_cost_templates_admin ON public.profiles;
CREATE TRIGGER trg_guard_profile_operational_cost_templates_admin
BEFORE INSERT OR UPDATE OF operational_cost_templates ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.cd_guard_profile_operational_cost_templates_admin();

COMMIT;
