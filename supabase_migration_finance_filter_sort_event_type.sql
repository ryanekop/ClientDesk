CREATE OR REPLACE FUNCTION public.cd_get_finance_page(
  p_page INTEGER DEFAULT 1,
  p_per_page INTEGER DEFAULT 10,
  p_filter TEXT DEFAULT 'all',
  p_search TEXT DEFAULT '',
  p_package_filter TEXT DEFAULT 'All',
  p_booking_status_filter TEXT DEFAULT 'All',
  p_package_filters JSONB DEFAULT '[]'::jsonb,
  p_booking_status_filters JSONB DEFAULT '[]'::jsonb,
  p_export_all BOOLEAN DEFAULT FALSE,
  p_event_type_filter TEXT DEFAULT 'All',
  p_event_type_filters JSONB DEFAULT '[]'::jsonb,
  p_date_from TEXT DEFAULT '',
  p_date_to TEXT DEFAULT '',
  p_date_basis TEXT DEFAULT 'booking_date',
  p_time_zone TEXT DEFAULT 'UTC',
  p_sort_order TEXT DEFAULT 'booking_newest'
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
      CASE
        WHEN COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(p_package_filters) = 'array' THEN p_package_filters ELSE '[]'::jsonb END), 0) > 0
          THEN COALESCE((
            SELECT array_agg(DISTINCT value)
            FROM (
              SELECT btrim(item.value) AS value
              FROM jsonb_array_elements_text(p_package_filters) AS item(value)
              WHERE btrim(item.value) <> ''
                AND lower(btrim(item.value)) <> 'all'
            ) prepared
          ), ARRAY[]::TEXT[])
        WHEN COALESCE(NULLIF(btrim(p_package_filter), ''), 'All') <> 'All'
          THEN ARRAY[COALESCE(NULLIF(btrim(p_package_filter), ''), 'All')]
        ELSE ARRAY[]::TEXT[]
      END AS package_filters,
      CASE
        WHEN COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(p_booking_status_filters) = 'array' THEN p_booking_status_filters ELSE '[]'::jsonb END), 0) > 0
          THEN COALESCE((
            SELECT array_agg(DISTINCT value)
            FROM (
              SELECT btrim(item.value) AS value
              FROM jsonb_array_elements_text(p_booking_status_filters) AS item(value)
              WHERE btrim(item.value) <> ''
                AND lower(btrim(item.value)) <> 'all'
            ) prepared
          ), ARRAY[]::TEXT[])
        WHEN COALESCE(NULLIF(btrim(p_booking_status_filter), ''), 'All') <> 'All'
          THEN ARRAY[COALESCE(NULLIF(btrim(p_booking_status_filter), ''), 'All')]
        ELSE ARRAY[]::TEXT[]
      END AS booking_status_filters,
      CASE
        WHEN COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(p_event_type_filters) = 'array' THEN p_event_type_filters ELSE '[]'::jsonb END), 0) > 0
          THEN COALESCE((
            SELECT array_agg(DISTINCT value)
            FROM (
              SELECT btrim(item.value) AS value
              FROM jsonb_array_elements_text(p_event_type_filters) AS item(value)
              WHERE btrim(item.value) <> ''
                AND lower(btrim(item.value)) <> 'all'
            ) prepared
          ), ARRAY[]::TEXT[])
        WHEN COALESCE(NULLIF(btrim(p_event_type_filter), ''), 'All') <> 'All'
          THEN ARRAY[COALESCE(NULLIF(btrim(p_event_type_filter), ''), 'All')]
        ELSE ARRAY[]::TEXT[]
      END AS event_type_filters,
      btrim(COALESCE(p_date_from, '')) AS date_from_filter,
      btrim(COALESCE(p_date_to, '')) AS date_to_filter,
      CASE
        WHEN lower(COALESCE(NULLIF(btrim(p_date_basis), ''), 'booking_date')) = 'session_date'
          THEN 'session_date'
        ELSE 'booking_date'
      END AS date_basis,
      COALESCE((
        SELECT tz.name
        FROM pg_timezone_names AS tz
        WHERE tz.name = COALESCE(NULLIF(btrim(p_time_zone), ''), 'UTC')
        LIMIT 1
      ), 'UTC') AS time_zone,
      COALESCE(NULLIF(btrim(p_sort_order), ''), 'booking_newest') AS sort_order,
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
        cardinality(params.package_filters) = 0
        OR COALESCE(row_data.main_service_names, ARRAY[]::TEXT[]) && params.package_filters
      )
      AND (
        cardinality(params.booking_status_filters) = 0
        OR row_data.unified_status = ANY(params.booking_status_filters)
      )
      AND (
        cardinality(params.event_type_filters) = 0
        OR row_data.event_type = ANY(params.event_type_filters)
      )
      AND (
        params.date_from_filter = ''
        OR (
          CASE
            WHEN params.date_basis = 'booking_date' THEN
              row_data.booking_date IS NOT NULL
              AND row_data.booking_date::text >= params.date_from_filter
            ELSE
              row_data.session_date IS NOT NULL
              AND (row_data.session_date AT TIME ZONE params.time_zone)::date::text >= params.date_from_filter
          END
        )
      )
      AND (
        params.date_to_filter = ''
        OR (
          CASE
            WHEN params.date_basis = 'booking_date' THEN
              row_data.booking_date IS NOT NULL
              AND row_data.booking_date::text <= params.date_to_filter
            ELSE
              row_data.session_date IS NOT NULL
              AND (row_data.session_date AT TIME ZONE params.time_zone)::date::text <= params.date_to_filter
          END
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
    'availableEventTypes', COALESCE((
      SELECT jsonb_agg(event_name ORDER BY event_name)
      FROM (
        SELECT DISTINCT event_type AS event_name
        FROM base_rows
        WHERE event_type IS NOT NULL
          AND btrim(event_type) <> ''
      ) event_types
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
