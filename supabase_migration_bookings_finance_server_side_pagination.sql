-- True Supabase-side pagination and filtering for bookings + finance.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION public.cd_to_numeric(
  p_value TEXT,
  p_default NUMERIC DEFAULT 0
) RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_value IS NULL OR btrim(p_value) = '' THEN p_default
    WHEN btrim(p_value) ~ '^[-+]?[0-9]+(\.[0-9]+)?$' THEN btrim(p_value)::numeric
    ELSE p_default
  END;
$$;

CREATE OR REPLACE FUNCTION public.cd_client_progress_statuses(
  p_statuses JSONB DEFAULT NULL
) RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  WITH source_statuses AS (
    SELECT CASE
      WHEN jsonb_typeof(p_statuses) = 'array' AND jsonb_array_length(p_statuses) > 0 THEN p_statuses
      ELSE to_jsonb(ARRAY[
        'Pending',
        'Booking Confirmed',
        'Sesi Foto / Acara',
        'Antrian Edit',
        'Proses Edit',
        'Revisi',
        'File Siap',
        'Selesai'
      ]::TEXT[])
    END AS statuses_json
  ),
  deduped AS (
    SELECT status, MIN(ord) AS ord
    FROM (
      SELECT NULLIF(btrim(value), '') AS status, ord
      FROM source_statuses,
      LATERAL jsonb_array_elements_text(statuses_json) WITH ORDINALITY AS item(value, ord)
    ) prepared
    WHERE status IS NOT NULL
      AND lower(status) <> 'batal'
    GROUP BY status
  ),
  middle_statuses AS (
    SELECT status, ord
    FROM deduped
    WHERE lower(status) <> 'pending'
      AND lower(status) <> 'selesai'
  )
  SELECT ARRAY['Pending']::TEXT[]
    || COALESCE(ARRAY(
      SELECT status
      FROM middle_statuses
      ORDER BY ord
    ), ARRAY[]::TEXT[])
    || ARRAY['Selesai']::TEXT[];
$$;

CREATE OR REPLACE FUNCTION public.cd_booking_status_options(
  p_statuses JSONB DEFAULT NULL
) RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.cd_client_progress_statuses(p_statuses) || ARRAY['Batal']::TEXT[];
$$;

CREATE OR REPLACE FUNCTION public.cd_resolve_unified_booking_status(
  p_status TEXT,
  p_client_status TEXT,
  p_statuses JSONB DEFAULT NULL
) RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  WITH normalized AS (
    SELECT
      COALESCE(public.cd_booking_status_options(p_statuses), ARRAY['Pending', 'Selesai', 'Batal']::TEXT[]) AS options,
      COALESCE(public.cd_client_progress_statuses(p_statuses), ARRAY['Pending', 'Selesai']::TEXT[]) AS progress_statuses,
      btrim(COALESCE(p_status, '')) AS normalized_status,
      btrim(COALESCE(p_client_status, '')) AS normalized_client_status
  )
  SELECT CASE
    WHEN lower(normalized_status) = 'batal' OR lower(normalized_client_status) = 'batal'
      THEN 'Batal'
    WHEN normalized_client_status <> '' AND normalized_client_status = ANY(options)
      THEN normalized_client_status
    WHEN normalized_status <> '' AND normalized_status = ANY(options)
      THEN normalized_status
    ELSE COALESCE(progress_statuses[1], 'Pending')
  END
  FROM normalized;
$$;

CREATE OR REPLACE FUNCTION public.cd_escape_like_query(
  p_value TEXT
) RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT replace(replace(replace(COALESCE(p_value, ''), '\\', '\\\\'), '%', '\\%'), '_', '\\_');
$$;

CREATE OR REPLACE FUNCTION public.cd_text_contains(
  p_source TEXT,
  p_query TEXT
) RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(p_source, '') ILIKE ('%' || public.cd_escape_like_query(COALESCE(p_query, '')) || '%') ESCAPE '\\';
$$;

CREATE OR REPLACE FUNCTION public.cd_stringify_form_field_value(
  p_value JSONB
) RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_kind TEXT;
  v_result TEXT;
BEGIN
  IF p_value IS NULL OR p_value = 'null'::jsonb THEN
    RETURN '';
  END IF;

  v_kind := jsonb_typeof(p_value);

  IF v_kind = 'string' THEN
    RETURN btrim(p_value #>> '{}');
  END IF;

  IF v_kind IN ('number', 'boolean') THEN
    RETURN p_value #>> '{}';
  END IF;

  IF v_kind = 'array' THEN
    SELECT COALESCE(string_agg(value_text, ', ' ORDER BY ord), '')
    INTO v_result
    FROM (
      SELECT public.cd_stringify_form_field_value(value) AS value_text, ord
      FROM jsonb_array_elements(p_value) WITH ORDINALITY AS item(value, ord)
    ) flattened
    WHERE value_text <> '';

    RETURN COALESCE(v_result, '');
  END IF;

  IF v_kind = 'object' THEN
    SELECT COALESCE(string_agg(value_text, ', '), '')
    INTO v_result
    FROM (
      SELECT public.cd_stringify_form_field_value(value) AS value_text
      FROM jsonb_each(p_value)
    ) flattened
    WHERE value_text <> '';

    RETURN COALESCE(v_result, '');
  END IF;

  RETURN '';
END;
$$;

CREATE OR REPLACE FUNCTION public.cd_extract_extra_field_map(
  p_raw JSONB
) RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_result JSONB := '{}'::jsonb;
  v_custom_fields JSONB;
BEGIN
  IF p_raw IS NULL OR jsonb_typeof(p_raw) <> 'object' THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_object_agg(key, value_text), '{}'::jsonb)
  INTO v_result
  FROM (
    SELECT entry.key,
           public.cd_stringify_form_field_value(entry.value) AS value_text
    FROM jsonb_each(p_raw) AS entry
    WHERE entry.key <> 'custom_fields'
  ) built_in
  WHERE value_text <> '';

  v_custom_fields := p_raw -> 'custom_fields';

  IF jsonb_typeof(v_custom_fields) = 'array' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_custom_fields) AS item(value)
      WHERE jsonb_typeof(value) <> 'object'
         OR NOT (value ? 'id' AND value ? 'label' AND value ? 'type' AND value ? 'value')
    ) THEN
      v_result := v_result || COALESCE((
        SELECT jsonb_object_agg(item.value ->> 'id', public.cd_stringify_form_field_value(item.value -> 'value'))
        FROM jsonb_array_elements(v_custom_fields) AS item(value)
      ), '{}'::jsonb);
    END IF;
  ELSIF jsonb_typeof(v_custom_fields) = 'object' THEN
    v_result := v_result || COALESCE((
      SELECT jsonb_object_agg(key, value_text)
      FROM (
        SELECT entry.key,
               public.cd_stringify_form_field_value(entry.value) AS value_text
        FROM jsonb_each(v_custom_fields) AS entry
      ) custom_object
      WHERE value_text <> ''
    ), '{}'::jsonb);
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.cd_final_adjustments_total(
  p_value JSONB
) RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(SUM(amount_value), 0)
  FROM (
    SELECT CASE
      WHEN btrim(COALESCE(item.value ->> 'label', '')) = '' THEN NULL
      ELSE CASE
        WHEN public.cd_to_numeric(item.value ->> 'amount', 0) > 0
          THEN public.cd_to_numeric(item.value ->> 'amount', 0)
        ELSE GREATEST(public.cd_to_numeric(item.value ->> 'unit_price', 0), 0)
          * GREATEST(public.cd_to_numeric(item.value ->> 'quantity', 1), 1)
      END
    END AS amount_value
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(p_value) = 'array' THEN p_value
        ELSE '[]'::jsonb
      END
    ) AS item(value)
    WHERE jsonb_typeof(item.value) = 'object'
  ) prepared
  WHERE amount_value IS NOT NULL
    AND amount_value > 0;
$$;

CREATE OR REPLACE FUNCTION public.cd_verified_final_payment_amount(
  p_final_paid_at TIMESTAMPTZ,
  p_is_fully_paid BOOLEAN,
  p_final_payment_amount NUMERIC
) RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_final_paid_at IS NOT NULL THEN COALESCE(p_final_payment_amount, 0)
    WHEN COALESCE(p_is_fully_paid, FALSE) AND COALESCE(p_final_payment_amount, 0) > 0
      THEN COALESCE(p_final_payment_amount, 0)
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.cd_verified_dp_amount(
  p_dp_verified_amount NUMERIC
) RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT GREATEST(COALESCE(p_dp_verified_amount, 0), 0);
$$;

CREATE OR REPLACE FUNCTION public.cd_dp_refund_amount(
  p_dp_refund_amount NUMERIC,
  p_dp_verified_amount NUMERIC
) RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT LEAST(
    GREATEST(COALESCE(p_dp_refund_amount, 0), 0),
    public.cd_verified_dp_amount(p_dp_verified_amount)
  );
$$;

CREATE OR REPLACE FUNCTION public.cd_final_invoice_total(
  p_total_price NUMERIC,
  p_final_adjustments JSONB
) RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(p_total_price, 0) + public.cd_final_adjustments_total(p_final_adjustments);
$$;

CREATE OR REPLACE FUNCTION public.cd_net_verified_revenue_amount(
  p_dp_verified_amount NUMERIC,
  p_dp_refund_amount NUMERIC,
  p_final_paid_at TIMESTAMPTZ,
  p_is_fully_paid BOOLEAN,
  p_final_payment_amount NUMERIC
) RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.cd_verified_dp_amount(p_dp_verified_amount)
    + public.cd_verified_final_payment_amount(p_final_paid_at, p_is_fully_paid, p_final_payment_amount)
    - public.cd_dp_refund_amount(p_dp_refund_amount, p_dp_verified_amount);
$$;

CREATE OR REPLACE FUNCTION public.cd_remaining_final_payment(
  p_total_price NUMERIC,
  p_dp_paid NUMERIC,
  p_final_adjustments JSONB,
  p_final_paid_at TIMESTAMPTZ,
  p_is_fully_paid BOOLEAN,
  p_final_payment_amount NUMERIC
) RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN COALESCE(p_is_fully_paid, FALSE) THEN 0
    ELSE GREATEST(
      public.cd_final_invoice_total(p_total_price, p_final_adjustments)
      - (
        COALESCE(p_dp_paid, 0)
        + public.cd_verified_final_payment_amount(p_final_paid_at, p_is_fully_paid, p_final_payment_amount)
      ),
      0
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.cd_is_same_utc_month(
  p_value TIMESTAMPTZ,
  p_reference TIMESTAMPTZ DEFAULT NOW()
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT p_value IS NOT NULL
    AND date_trunc('month', timezone('UTC', p_value)) = date_trunc('month', timezone('UTC', p_reference));
$$;

CREATE OR REPLACE FUNCTION public.cd_booking_listing_rows()
RETURNS TABLE (
  id UUID,
  booking_payload JSONB,
  booking_code TEXT,
  client_name TEXT,
  location TEXT,
  booking_date DATE,
  created_at TIMESTAMPTZ,
  session_date TIMESTAMPTZ,
  unified_status TEXT,
  event_type TEXT,
  extra_field_map JSONB,
  main_service_names TEXT[],
  freelancer_names TEXT[],
  service_label TEXT,
  total_price NUMERIC,
  dp_paid NUMERIC,
  dp_verified_amount NUMERIC,
  dp_verified_at TIMESTAMPTZ,
  dp_refund_amount NUMERIC,
  dp_refunded_at TIMESTAMPTZ,
  is_fully_paid BOOLEAN,
  settlement_status TEXT,
  final_adjustments JSONB,
  final_payment_amount NUMERIC,
  final_paid_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH profile_data AS (
    SELECT p.id, p.custom_client_statuses
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
  SELECT
    b.id,
    to_jsonb(b) || jsonb_build_object(
      'services', service_data.legacy_service_json,
      'booking_services', service_data.booking_services_json,
      'freelance', freelance_data.legacy_freelance_json,
      'booking_freelance', freelance_data.booking_freelance_json
    ) AS booking_payload,
    b.booking_code,
    b.client_name,
    b.location,
    b.booking_date,
    b.created_at,
    b.session_date,
    public.cd_resolve_unified_booking_status(
      b.status,
      b.client_status,
      profile_data.custom_client_statuses
    ) AS unified_status,
    b.event_type,
    public.cd_extract_extra_field_map(b.extra_fields) AS extra_field_map,
    CASE
      WHEN cardinality(service_data.primary_service_names) > 0 THEN service_data.primary_service_names
      WHEN legacy_service.id IS NOT NULL AND COALESCE(legacy_service.is_addon, FALSE) = FALSE
        THEN ARRAY[legacy_service.name]::TEXT[]
      ELSE ARRAY[]::TEXT[]
    END AS main_service_names,
    CASE
      WHEN cardinality(freelance_data.junction_freelancer_names) > 0 THEN freelance_data.junction_freelancer_names
      WHEN legacy_freelance.id IS NOT NULL THEN ARRAY[legacy_freelance.name]::TEXT[]
      ELSE ARRAY[]::TEXT[]
    END AS freelancer_names,
    CASE
      WHEN cardinality(service_data.primary_service_names) > 0
        THEN array_to_string(service_data.primary_service_names, ', ')
      ELSE COALESCE(legacy_service.name, '-')
    END AS service_label,
    b.total_price,
    b.dp_paid,
    b.dp_verified_amount,
    b.dp_verified_at,
    b.dp_refund_amount,
    b.dp_refunded_at,
    b.is_fully_paid,
    b.settlement_status,
    b.final_adjustments,
    b.final_payment_amount,
    b.final_paid_at
  FROM public.bookings b
  JOIN profile_data ON profile_data.id = b.user_id
  LEFT JOIN public.services legacy_service
    ON legacy_service.id = b.service_id
  LEFT JOIN public.freelance legacy_freelance
    ON legacy_freelance.id = b.freelance_id
  LEFT JOIN LATERAL (
    SELECT
      CASE
        WHEN legacy_service.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', legacy_service.id,
          'name', legacy_service.name,
          'price', legacy_service.price,
          'is_addon', legacy_service.is_addon
        )
      END AS legacy_service_json,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', bs.id,
            'kind', COALESCE(bs.kind, 'main'),
            'sort_order', COALESCE(bs.sort_order, 0),
            'service', CASE
              WHEN svc.id IS NULL THEN NULL
              ELSE jsonb_build_object(
                'id', svc.id,
                'name', svc.name,
                'price', svc.price,
                'is_addon', svc.is_addon
              )
            END
          )
          ORDER BY CASE WHEN COALESCE(bs.kind, 'main') = 'main' THEN 0 ELSE 1 END,
                   COALESCE(bs.sort_order, 0),
                   COALESCE(svc.name, '')
        ) FILTER (WHERE bs.id IS NOT NULL),
        '[]'::jsonb
      ) AS booking_services_json,
      COALESCE(
        array_agg(svc.name ORDER BY COALESCE(bs.sort_order, 0), COALESCE(svc.name, ''))
        FILTER (
          WHERE bs.id IS NOT NULL
            AND svc.name IS NOT NULL
            AND COALESCE(bs.kind, 'main') = 'main'
        ),
        ARRAY[]::TEXT[]
      ) AS primary_service_names
    FROM public.booking_services bs
    LEFT JOIN public.services svc
      ON svc.id = bs.service_id
    WHERE bs.booking_id = b.id
  ) AS service_data ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      CASE
        WHEN legacy_freelance.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', legacy_freelance.id,
          'name', legacy_freelance.name,
          'whatsapp_number', legacy_freelance.whatsapp_number
        )
      END AS legacy_freelance_json,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'freelance_id', bf.freelance_id,
            'freelance', CASE
              WHEN f.id IS NULL THEN NULL
              ELSE jsonb_build_object(
                'id', f.id,
                'name', f.name,
                'whatsapp_number', f.whatsapp_number
              )
            END
          )
          ORDER BY COALESCE(bf.created_at, b.created_at), COALESCE(f.name, '')
        ) FILTER (WHERE bf.id IS NOT NULL),
        '[]'::jsonb
      ) AS booking_freelance_json,
      COALESCE(
        array_agg(f.name ORDER BY COALESCE(bf.created_at, b.created_at), COALESCE(f.name, ''))
        FILTER (WHERE bf.id IS NOT NULL AND f.name IS NOT NULL),
        ARRAY[]::TEXT[]
      ) AS junction_freelancer_names
    FROM public.booking_freelance bf
    LEFT JOIN public.freelance f
      ON f.id = bf.freelance_id
    WHERE bf.booking_id = b.id
  ) AS freelance_data ON TRUE
  WHERE b.user_id = auth.uid();
$$;

CREATE INDEX IF NOT EXISTS bookings_user_created_at_desc_idx
  ON public.bookings (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS bookings_user_booking_date_desc_idx
  ON public.bookings (user_id, booking_date DESC);

CREATE INDEX IF NOT EXISTS bookings_user_session_date_idx
  ON public.bookings (user_id, session_date);

CREATE INDEX IF NOT EXISTS bookings_user_event_type_idx
  ON public.bookings (user_id, event_type);

CREATE INDEX IF NOT EXISTS bookings_user_status_idx
  ON public.bookings (user_id, status);

CREATE INDEX IF NOT EXISTS bookings_user_client_status_idx
  ON public.bookings (user_id, client_status);

CREATE INDEX IF NOT EXISTS booking_services_booking_kind_sort_idx
  ON public.booking_services (booking_id, kind, sort_order);

CREATE INDEX IF NOT EXISTS booking_freelance_booking_freelance_idx
  ON public.booking_freelance (booking_id, freelance_id);

CREATE INDEX IF NOT EXISTS bookings_extra_fields_gin_idx
  ON public.bookings USING gin (extra_fields);

CREATE INDEX IF NOT EXISTS bookings_client_name_trgm_idx
  ON public.bookings USING gin (client_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS bookings_booking_code_trgm_idx
  ON public.bookings USING gin (booking_code gin_trgm_ops);

CREATE INDEX IF NOT EXISTS bookings_location_trgm_idx
  ON public.bookings USING gin (location gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.cd_get_bookings_page(
  p_page INTEGER DEFAULT 1,
  p_per_page INTEGER DEFAULT 10,
  p_search TEXT DEFAULT '',
  p_status_filter TEXT DEFAULT 'All',
  p_package_filter TEXT DEFAULT 'All',
  p_freelance_filter TEXT DEFAULT 'All',
  p_event_type_filter TEXT DEFAULT 'All',
  p_date_from TEXT DEFAULT '',
  p_date_to TEXT DEFAULT '',
  p_sort_order TEXT DEFAULT 'booking_newest',
  p_extra_filters JSONB DEFAULT '{}'::jsonb,
  p_export_all BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH params AS (
    SELECT
      GREATEST(COALESCE(p_page, 1), 1) AS page,
      GREATEST(COALESCE(p_per_page, 10), 1) AS per_page,
      btrim(COALESCE(p_search, '')) AS search_query,
      COALESCE(NULLIF(btrim(p_status_filter), ''), 'All') AS status_filter,
      COALESCE(NULLIF(btrim(p_package_filter), ''), 'All') AS package_filter,
      COALESCE(NULLIF(btrim(p_freelance_filter), ''), 'All') AS freelance_filter,
      COALESCE(NULLIF(btrim(p_event_type_filter), ''), 'All') AS event_type_filter,
      btrim(COALESCE(p_date_from, '')) AS date_from_filter,
      btrim(COALESCE(p_date_to, '')) AS date_to_filter,
      COALESCE(NULLIF(btrim(p_sort_order), ''), 'booking_newest') AS sort_order,
      COALESCE(p_extra_filters, '{}'::jsonb) AS extra_filters,
      COALESCE(p_export_all, FALSE) AS export_all
  ),
  filtered AS (
    SELECT row_data.*
    FROM public.cd_booking_listing_rows() AS row_data
    CROSS JOIN params
    WHERE (
      params.search_query = ''
      OR public.cd_text_contains(row_data.client_name, params.search_query)
      OR public.cd_text_contains(row_data.booking_code, params.search_query)
      OR public.cd_text_contains(row_data.location, params.search_query)
    )
      AND (
        params.status_filter = 'All'
        OR row_data.unified_status = params.status_filter
      )
      AND (
        params.package_filter = 'All'
        OR params.package_filter = ANY(row_data.main_service_names)
      )
      AND (
        params.freelance_filter = 'All'
        OR params.freelance_filter = ANY(row_data.freelancer_names)
      )
      AND (
        params.event_type_filter = 'All'
        OR row_data.event_type = params.event_type_filter
      )
      AND (
        params.date_from_filter = ''
        OR (
          row_data.session_date IS NOT NULL
          AND (row_data.session_date AT TIME ZONE 'UTC')::date::text >= params.date_from_filter
        )
      )
      AND (
        params.date_to_filter = ''
        OR (
          row_data.session_date IS NOT NULL
          AND (row_data.session_date AT TIME ZONE 'UTC')::date::text <= params.date_to_filter
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_each_text(params.extra_filters) AS filter_entry(key, value)
        WHERE btrim(COALESCE(filter_entry.value, '')) <> ''
          AND (
            NULLIF(btrim(COALESCE(row_data.extra_field_map ->> filter_entry.key, '')), '') IS NULL
            OR NOT public.cd_text_contains(
              row_data.extra_field_map ->> filter_entry.key,
              btrim(filter_entry.value)
            )
          )
      )
  ),
  ordered AS (
    SELECT
      filtered.*,
      row_number() OVER (
        ORDER BY
          CASE WHEN params.sort_order = 'booking_newest'
            THEN COALESCE(filtered.booking_date::text, filtered.created_at::text, '')
          END DESC,
          CASE WHEN params.sort_order = 'booking_newest'
            THEN COALESCE(filtered.created_at::text, '')
          END DESC,
          CASE WHEN params.sort_order = 'booking_oldest'
            THEN COALESCE(filtered.booking_date::text, filtered.created_at::text, '')
          END ASC,
          CASE WHEN params.sort_order = 'booking_oldest'
            THEN COALESCE(filtered.created_at::text, '')
          END ASC,
          CASE WHEN params.sort_order = 'session_newest'
            THEN COALESCE(filtered.session_date::text, '')
          END ASC,
          CASE WHEN params.sort_order NOT IN ('booking_newest', 'booking_oldest', 'session_newest')
            THEN COALESCE(filtered.session_date::text, '')
          END DESC,
          filtered.created_at DESC,
          filtered.id DESC
      ) AS row_num
    FROM filtered
    CROSS JOIN params
  ),
  paged AS (
    SELECT ordered.*
    FROM ordered
    CROSS JOIN params
    WHERE params.export_all
      OR (
        ordered.row_num > ((params.page - 1) * params.per_page)
        AND ordered.row_num <= (params.page * params.per_page)
      )
  )
  SELECT jsonb_build_object(
    'items', COALESCE((
      SELECT jsonb_agg(booking_payload ORDER BY row_num)
      FROM paged
    ), '[]'::jsonb),
    'totalItems', COALESCE((SELECT COUNT(*) FROM filtered), 0)
  );
$$;

CREATE OR REPLACE FUNCTION public.cd_get_bookings_metadata(
  p_event_type_filter TEXT DEFAULT 'All'
) RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH profile_data AS (
    SELECT
      p.studio_name,
      p.custom_client_statuses,
      p.queue_trigger_status,
      p.dp_verify_trigger_status,
      p.default_wa_target,
      p.form_sections,
      p.table_column_preferences
    FROM public.profiles p
    WHERE p.id = auth.uid()
  ),
  base_rows AS (
    SELECT *
    FROM public.cd_booking_listing_rows()
  ),
  raw_booking_rows AS (
    SELECT b.event_type, b.extra_fields
    FROM public.bookings b
    WHERE b.user_id = auth.uid()
    ORDER BY b.created_at DESC
  )
  SELECT jsonb_build_object(
    'studioName', COALESCE((SELECT studio_name FROM profile_data), ''),
    'statusOptions', to_jsonb(public.cd_booking_status_options((SELECT custom_client_statuses FROM profile_data))),
    'queueTriggerStatus', COALESCE((SELECT queue_trigger_status FROM profile_data), 'Antrian Edit'),
    'dpVerifyTriggerStatus', COALESCE((SELECT dp_verify_trigger_status FROM profile_data), ''),
    'defaultWaTarget', COALESCE((SELECT default_wa_target FROM profile_data), 'client'),
    'packages', COALESCE((
      SELECT jsonb_agg(package_name ORDER BY package_name)
      FROM (
        SELECT DISTINCT package_name
        FROM base_rows,
        LATERAL unnest(main_service_names) AS package_name
        WHERE package_name <> ''
      ) packages
    ), '[]'::jsonb),
    'freelancerNames', COALESCE((
      SELECT jsonb_agg(freelancer_name ORDER BY freelancer_name)
      FROM (
        SELECT DISTINCT freelancer_name
        FROM base_rows,
        LATERAL unnest(freelancer_names) AS freelancer_name
        WHERE freelancer_name <> ''
      ) freelancers
    ), '[]'::jsonb),
    'availableEventTypes', COALESCE((
      SELECT jsonb_agg(event_name ORDER BY event_name)
      FROM (
        SELECT DISTINCT event_type AS event_name
        FROM base_rows
        WHERE event_type IS NOT NULL
          AND btrim(event_type) <> ''
      ) event_types
    ), '[]'::jsonb),
    'formSectionsByEventType', COALESCE((
      SELECT CASE
        WHEN jsonb_typeof(form_sections) = 'object' THEN form_sections
        ELSE '{}'::jsonb
      END
      FROM profile_data
    ), '{}'::jsonb),
    'tableColumnPreferences', COALESCE((
      SELECT table_column_preferences -> 'bookings'
      FROM profile_data
    ), 'null'::jsonb),
    'metadataRows', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'event_type', event_type,
          'extra_fields', extra_fields
        )
      )
      FROM raw_booking_rows
    ), '[]'::jsonb),
    'extraFieldRows', CASE
      WHEN COALESCE(NULLIF(btrim(p_event_type_filter), ''), 'All') = 'All'
        THEN '[]'::jsonb
      ELSE COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'event_type', event_type,
            'extra_fields', extra_fields
          )
        )
        FROM raw_booking_rows
        WHERE event_type = COALESCE(NULLIF(btrim(p_event_type_filter), ''), 'All')
      ), '[]'::jsonb)
    END
  );
$$;

CREATE OR REPLACE FUNCTION public.cd_get_finance_page(
  p_page INTEGER DEFAULT 1,
  p_per_page INTEGER DEFAULT 10,
  p_filter TEXT DEFAULT 'all',
  p_search TEXT DEFAULT '',
  p_package_filter TEXT DEFAULT 'All',
  p_booking_status_filter TEXT DEFAULT 'All',
  p_export_all BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH params AS (
    SELECT
      GREATEST(COALESCE(p_page, 1), 1) AS page,
      GREATEST(COALESCE(p_per_page, 10), 1) AS per_page,
      lower(COALESCE(NULLIF(btrim(p_filter), ''), 'all')) AS finance_filter,
      btrim(COALESCE(p_search, '')) AS search_query,
      COALESCE(NULLIF(btrim(p_package_filter), ''), 'All') AS package_filter,
      COALESCE(NULLIF(btrim(p_booking_status_filter), ''), 'All') AS booking_status_filter,
      COALESCE(p_export_all, FALSE) AS export_all
  ),
  filtered AS (
    SELECT row_data.*
    FROM public.cd_booking_listing_rows() AS row_data
    CROSS JOIN params
    WHERE (
      params.finance_filter = 'all'
      OR (
        params.finance_filter = 'paid'
        AND row_data.unified_status <> 'Batal'
        AND COALESCE(row_data.is_fully_paid, FALSE)
      )
      OR (
        params.finance_filter <> 'all'
        AND params.finance_filter <> 'paid'
        AND row_data.unified_status <> 'Batal'
        AND NOT COALESCE(row_data.is_fully_paid, FALSE)
      )
    )
      AND (
        params.search_query = ''
        OR public.cd_text_contains(row_data.client_name, params.search_query)
        OR public.cd_text_contains(row_data.booking_code, params.search_query)
        OR public.cd_text_contains(row_data.location, params.search_query)
        OR public.cd_text_contains(row_data.service_label, params.search_query)
        OR EXISTS (
          SELECT 1
          FROM unnest(row_data.main_service_names) AS package_name
          WHERE public.cd_text_contains(package_name, params.search_query)
        )
      )
      AND (
        params.package_filter = 'All'
        OR params.package_filter = ANY(row_data.main_service_names)
      )
      AND (
        params.booking_status_filter = 'All'
        OR row_data.unified_status = params.booking_status_filter
      )
  ),
  ordered AS (
    SELECT
      filtered.*,
      row_number() OVER (
        ORDER BY filtered.created_at DESC, filtered.id DESC
      ) AS row_num
    FROM filtered
  ),
  paged AS (
    SELECT ordered.*
    FROM ordered
    CROSS JOIN params
    WHERE params.export_all
      OR (
        ordered.row_num > ((params.page - 1) * params.per_page)
        AND ordered.row_num <= (params.page * params.per_page)
      )
  )
  SELECT jsonb_build_object(
    'items', COALESCE((
      SELECT jsonb_agg(booking_payload ORDER BY row_num)
      FROM paged
    ), '[]'::jsonb),
    'totalItems', COALESCE((SELECT COUNT(*) FROM filtered), 0)
  );
$$;

CREATE OR REPLACE FUNCTION public.cd_get_finance_metadata()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH profile_data AS (
    SELECT
      p.studio_name,
      p.table_column_preferences,
      p.form_sections,
      p.custom_client_statuses
    FROM public.profiles p
    WHERE p.id = auth.uid()
  ),
  base_rows AS (
    SELECT *
    FROM public.cd_booking_listing_rows()
  ),
  raw_booking_rows AS (
    SELECT b.event_type, b.extra_fields
    FROM public.bookings b
    WHERE b.user_id = auth.uid()
    ORDER BY b.created_at DESC
  ),
  summary_rows AS (
    SELECT
      COUNT(*) AS total_bookings,
      COALESCE(SUM(public.cd_net_verified_revenue_amount(
        dp_verified_amount,
        dp_refund_amount,
        final_paid_at,
        is_fully_paid,
        final_payment_amount
      )), 0) AS total_revenue,
      COALESCE(SUM(CASE
        WHEN unified_status <> 'Batal' AND NOT COALESCE(is_fully_paid, FALSE)
          THEN public.cd_remaining_final_payment(
            total_price,
            dp_paid,
            final_adjustments,
            final_paid_at,
            is_fully_paid,
            final_payment_amount
          )
        ELSE 0
      END), 0) AS total_pending,
      COALESCE(SUM(public.cd_verified_dp_amount(dp_verified_amount)), 0) AS total_dp,
      COALESCE(SUM(CASE
        WHEN unified_status <> 'Batal' AND COALESCE(is_fully_paid, FALSE) THEN 1
        ELSE 0
      END), 0) AS paid_count,
      COALESCE(SUM(CASE
        WHEN unified_status <> 'Batal' AND NOT COALESCE(is_fully_paid, FALSE) THEN 1
        ELSE 0
      END), 0) AS unpaid_count,
      COALESCE(SUM(
        CASE WHEN public.cd_is_same_utc_month(dp_verified_at)
          THEN public.cd_verified_dp_amount(dp_verified_amount)
          ELSE 0
        END
        + CASE WHEN public.cd_is_same_utc_month(final_paid_at)
          THEN GREATEST(COALESCE(final_payment_amount, 0), 0)
          ELSE 0
        END
        - CASE WHEN public.cd_is_same_utc_month(dp_refunded_at)
          THEN public.cd_dp_refund_amount(dp_refund_amount, dp_verified_amount)
          ELSE 0
        END
      ), 0) AS monthly_revenue_total
    FROM base_rows
  )
  SELECT jsonb_build_object(
    'studioName', COALESCE((SELECT studio_name FROM profile_data), ''),
    'bookingStatusOptions', to_jsonb(public.cd_booking_status_options((SELECT custom_client_statuses FROM profile_data))),
    'packageOptions', COALESCE((
      SELECT jsonb_agg(package_name ORDER BY package_name)
      FROM (
        SELECT DISTINCT package_name
        FROM base_rows,
        LATERAL unnest(main_service_names) AS package_name
        WHERE package_name <> ''
      ) packages
    ), '[]'::jsonb),
    'tableColumnPreferences', COALESCE((
      SELECT table_column_preferences -> 'finance'
      FROM profile_data
    ), 'null'::jsonb),
    'formSectionsByEventType', COALESCE((
      SELECT CASE
        WHEN jsonb_typeof(form_sections) = 'object' THEN form_sections
        ELSE '{}'::jsonb
      END
      FROM profile_data
    ), '{}'::jsonb),
    'metadataRows', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'event_type', event_type,
          'extra_fields', extra_fields
        )
      )
      FROM raw_booking_rows
    ), '[]'::jsonb),
    'summary', jsonb_build_object(
      'totalRevenue', COALESCE((SELECT total_revenue FROM summary_rows), 0),
      'totalPending', COALESCE((SELECT total_pending FROM summary_rows), 0),
      'totalDP', COALESCE((SELECT total_dp FROM summary_rows), 0),
      'totalBookings', COALESCE((SELECT total_bookings FROM summary_rows), 0),
      'paidCount', COALESCE((SELECT paid_count FROM summary_rows), 0),
      'unpaidCount', COALESCE((SELECT unpaid_count FROM summary_rows), 0),
      'monthlyRevenueTotal', COALESCE((SELECT monthly_revenue_total FROM summary_rows), 0)
    )
  );
$$;
