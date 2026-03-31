BEGIN;

-- Merge duplicate manual references into canonical non-manual references.
-- Mapping:
-- 1) UPH (manual) -> Universitas Pelita Harapan (kip_kuliah)
-- 2) UPNVYK (manual) -> Universitas Pembangunan Nasional Veteran Yogyakarta (kip_kuliah)

DO $$
DECLARE
  source_1 CONSTANT UUID := '12399cd9-e880-4991-9ce8-eb452399fd99';
  target_1 CONSTANT UUID := '294be8d8-786e-4660-ba49-dbbb9856caa6';
  source_2 CONSTANT UUID := '2b57cb79-7a0f-4d46-9f09-1b663db71102';
  target_2 CONSTANT UUID := '0becf318-f596-43dd-87d5-28ad811cb93f';
  source_1_source TEXT;
  source_2_source TEXT;
  target_1_source TEXT;
  target_2_source TEXT;
  remaining_1 BIGINT;
  remaining_2 BIGINT;
BEGIN
  SELECT source INTO source_1_source
  FROM public.university_references
  WHERE id = source_1;

  SELECT source INTO source_2_source
  FROM public.university_references
  WHERE id = source_2;

  SELECT source INTO target_1_source
  FROM public.university_references
  WHERE id = target_1;

  SELECT source INTO target_2_source
  FROM public.university_references
  WHERE id = target_2;

  IF target_1_source IS NULL THEN
    RAISE EXCEPTION 'Target reference % not found.', target_1;
  END IF;
  IF target_2_source IS NULL THEN
    RAISE EXCEPTION 'Target reference % not found.', target_2;
  END IF;

  IF source_1_source IS NOT NULL AND source_1_source <> 'manual' THEN
    RAISE EXCEPTION 'Source reference % must be manual. Found: %', source_1, source_1_source;
  END IF;
  IF source_2_source IS NOT NULL AND source_2_source <> 'manual' THEN
    RAISE EXCEPTION 'Source reference % must be manual. Found: %', source_2, source_2_source;
  END IF;
  IF target_1_source = 'manual' THEN
    RAISE EXCEPTION 'Target reference % must be non-manual.', target_1;
  END IF;
  IF target_2_source = 'manual' THEN
    RAISE EXCEPTION 'Target reference % must be non-manual.', target_2;
  END IF;

  -- Fill abbreviation only if target abbreviation is currently empty.
  UPDATE public.university_references
  SET
    abbreviation = 'UPH',
    normalized_abbreviation = 'uph'
  WHERE
    id = target_1
    AND COALESCE(NULLIF(BTRIM(abbreviation), ''), '') = '';

  UPDATE public.university_references
  SET
    abbreviation = 'UPNVYK',
    normalized_abbreviation = 'upnvyk'
  WHERE
    id = target_2
    AND COALESCE(NULLIF(BTRIM(abbreviation), ''), '') = '';

  -- Repoint booking references and normalize display value.
  UPDATE public.bookings
  SET
    extra_fields = jsonb_set(
      jsonb_set(
        COALESCE(extra_fields, '{}'::jsonb) - 'universitas_abbreviation_draft',
        '{universitas_ref_id}',
        to_jsonb(target_1::TEXT),
        true
      ),
      '{universitas}',
      to_jsonb('Universitas Pelita Harapan (UPH)'::TEXT),
      true
    ),
    updated_at = NOW()
  WHERE COALESCE(extra_fields, '{}'::jsonb)->>'universitas_ref_id' = source_1::TEXT;

  UPDATE public.bookings
  SET
    extra_fields = jsonb_set(
      jsonb_set(
        COALESCE(extra_fields, '{}'::jsonb) - 'universitas_abbreviation_draft',
        '{universitas_ref_id}',
        to_jsonb(target_2::TEXT),
        true
      ),
      '{universitas}',
      to_jsonb('Universitas Pembangunan Nasional Veteran Yogyakarta (UPNVYK)'::TEXT),
      true
    ),
    updated_at = NOW()
  WHERE COALESCE(extra_fields, '{}'::jsonb)->>'universitas_ref_id' = source_2::TEXT;

  SELECT COUNT(*) INTO remaining_1
  FROM public.bookings
  WHERE COALESCE(extra_fields, '{}'::jsonb)->>'universitas_ref_id' = source_1::TEXT;

  SELECT COUNT(*) INTO remaining_2
  FROM public.bookings
  WHERE COALESCE(extra_fields, '{}'::jsonb)->>'universitas_ref_id' = source_2::TEXT;

  IF remaining_1 > 0 THEN
    RAISE EXCEPTION 'Bookings still reference source %: % rows', source_1, remaining_1;
  END IF;

  IF remaining_2 > 0 THEN
    RAISE EXCEPTION 'Bookings still reference source %: % rows', source_2, remaining_2;
  END IF;

  DELETE FROM public.university_references
  WHERE id IN (source_1, source_2)
    AND source = 'manual';
END;
$$ LANGUAGE plpgsql;

COMMIT;
