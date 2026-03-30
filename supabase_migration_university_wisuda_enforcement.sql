-- Enforcement permanen: field universitas hanya boleh tersimpan untuk event Wisuda.
-- Idempotent: aman dijalankan berulang kali.

CREATE OR REPLACE FUNCTION sanitize_booking_university_fields_non_wisuda()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.extra_fields IS NULL THEN
    RETURN NEW;
  END IF;

  IF COALESCE(LOWER(TRIM(NEW.event_type)), '') <> 'wisuda' THEN
    NEW.extra_fields := NULLIF(
      (
        COALESCE(NEW.extra_fields, '{}'::jsonb)
        - 'universitas'
        - 'universitas_ref_id'
        - 'universitas_abbreviation_draft'
      ),
      '{}'::jsonb
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_sanitize_university_fields_non_wisuda
ON bookings;

CREATE TRIGGER bookings_sanitize_university_fields_non_wisuda
BEFORE INSERT OR UPDATE OF event_type, extra_fields ON bookings
FOR EACH ROW
EXECUTE FUNCTION sanitize_booking_university_fields_non_wisuda();
