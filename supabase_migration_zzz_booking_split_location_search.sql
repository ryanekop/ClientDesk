-- Extend booking list search to split-session location fields.
-- Must run after archive + split session date filtering migrations.

CREATE OR REPLACE FUNCTION public.cd_get_bookings_page(
  p_page INTEGER DEFAULT 1,
  p_per_page INTEGER DEFAULT 10,
  p_search TEXT DEFAULT '',
  p_status_filter TEXT DEFAULT 'All',
  p_package_filter TEXT DEFAULT 'All',
  p_freelance_filter TEXT DEFAULT 'All',
  p_event_type_filter TEXT DEFAULT 'All',
  p_status_filters JSONB DEFAULT '[]'::jsonb,
  p_package_filters JSONB DEFAULT '[]'::jsonb,
  p_freelance_filters JSONB DEFAULT '[]'::jsonb,
  p_event_type_filters JSONB DEFAULT '[]'::jsonb,
  p_date_from TEXT DEFAULT '',
  p_date_to TEXT DEFAULT '',
  p_date_basis TEXT DEFAULT 'booking_date',
  p_time_zone TEXT DEFAULT 'UTC',
  p_sort_order TEXT DEFAULT 'booking_newest',
  p_extra_filters JSONB DEFAULT '{}'::jsonb,
  p_export_all BOOLEAN DEFAULT FALSE,
  p_archive_mode TEXT DEFAULT 'active'
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
      CASE
        WHEN COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(p_status_filters) = 'array' THEN p_status_filters ELSE '[]'::jsonb END), 0) > 0
          THEN COALESCE((
            SELECT array_agg(DISTINCT value)
            FROM (
              SELECT btrim(item.value) AS value
              FROM jsonb_array_elements_text(p_status_filters) AS item(value)
              WHERE btrim(item.value) <> ''
                AND lower(btrim(item.value)) <> 'all'
            ) prepared
          ), ARRAY[]::TEXT[])
        WHEN COALESCE(NULLIF(btrim(p_status_filter), ''), 'All') <> 'All'
          THEN ARRAY[COALESCE(NULLIF(btrim(p_status_filter), ''), 'All')]
        ELSE ARRAY[]::TEXT[]
      END AS status_filters,
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
        WHEN COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(p_freelance_filters) = 'array' THEN p_freelance_filters ELSE '[]'::jsonb END), 0) > 0
          THEN COALESCE((
            SELECT array_agg(DISTINCT value)
            FROM (
              SELECT btrim(item.value) AS value
              FROM jsonb_array_elements_text(p_freelance_filters) AS item(value)
              WHERE btrim(item.value) <> ''
                AND lower(btrim(item.value)) <> 'all'
            ) prepared
          ), ARRAY[]::TEXT[])
        WHEN COALESCE(NULLIF(btrim(p_freelance_filter), ''), 'All') <> 'All'
          THEN ARRAY[COALESCE(NULLIF(btrim(p_freelance_filter), ''), 'All')]
        ELSE ARRAY[]::TEXT[]
      END AS freelance_filters,
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
      public.cd_safe_timezone_name(p_time_zone, 'UTC') AS time_zone,
      COALESCE(NULLIF(btrim(p_sort_order), ''), 'booking_newest') AS sort_order,
      COALESCE(p_extra_filters, '{}'::jsonb) AS extra_filters,
      COALESCE(p_export_all, FALSE) AS export_all,
      public.cd_normalize_archive_mode(p_archive_mode) AS archive_mode
  ),
  filtered AS (
    SELECT row_data.*
    FROM public.cd_booking_listing_filter_rows() AS row_data
    CROSS JOIN params
    CROSS JOIN LATERAL (
      SELECT public.cd_collect_booking_session_filter_dates(
        row_data.session_date,
        row_data.extra_field_map,
        params.time_zone
      ) AS session_filter_dates
    ) AS derived_dates
    WHERE (
      (params.archive_mode = 'archived' AND row_data.archived_at IS NOT NULL)
      OR (params.archive_mode <> 'archived' AND row_data.archived_at IS NULL)
    )
      AND (
        params.search_query = ''
        OR public.cd_text_contains(row_data.client_name, params.search_query)
        OR public.cd_text_contains(row_data.booking_code, params.search_query)
        OR public.cd_text_contains(row_data.location, params.search_query)
        OR public.cd_text_contains(
          concat_ws(
            ' ',
            row_data.extra_field_map ->> 'tempat_wisuda_1',
            row_data.extra_field_map ->> 'tempat_wisuda_2',
            row_data.extra_field_map ->> 'tempat_akad',
            row_data.extra_field_map ->> 'tempat_resepsi'
          ),
          params.search_query
        )
      )
      AND (
        cardinality(params.status_filters) = 0
        OR row_data.unified_status = ANY(params.status_filters)
      )
      AND (
        cardinality(params.package_filters) = 0
        OR COALESCE(row_data.main_service_names, ARRAY[]::TEXT[]) && params.package_filters
      )
      AND (
        cardinality(params.freelance_filters) = 0
        OR COALESCE(row_data.freelancer_names, ARRAY[]::TEXT[]) && params.freelance_filters
      )
      AND (
        cardinality(params.event_type_filters) = 0
        OR row_data.event_type = ANY(params.event_type_filters)
      )
      AND (
        (
          params.date_from_filter = ''
          AND params.date_to_filter = ''
        )
        OR (
          CASE
            WHEN params.date_basis = 'booking_date' THEN
              row_data.booking_date IS NOT NULL
              AND (
                params.date_from_filter = ''
                OR row_data.booking_date::text >= params.date_from_filter
              )
              AND (
                params.date_to_filter = ''
                OR row_data.booking_date::text <= params.date_to_filter
              )
            ELSE
              EXISTS (
                SELECT 1
                FROM unnest(derived_dates.session_filter_dates) AS session_filter_date(value)
                WHERE (
                  params.date_from_filter = ''
                  OR value >= params.date_from_filter
                )
                  AND (
                    params.date_to_filter = ''
                    OR value <= params.date_to_filter
                  )
              )
          END
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
      filtered.id,
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
  paged_ids AS (
    SELECT ordered.id, ordered.row_num
    FROM ordered
    CROSS JOIN params
    WHERE params.export_all
      OR (
        ordered.row_num > ((params.page - 1) * params.per_page)
        AND ordered.row_num <= (params.page * params.per_page)
      )
  ),
  payload_rows AS (
    SELECT payload.id, payload.booking_payload
    FROM public.cd_booking_listing_payload_rows(
      (SELECT COALESCE(array_agg(id), ARRAY[]::UUID[]) FROM paged_ids)
    ) AS payload
  ),
  paged AS (
    SELECT paged_ids.row_num, payload_rows.booking_payload
    FROM paged_ids
    JOIN payload_rows ON payload_rows.id = paged_ids.id
  )
  SELECT jsonb_build_object(
    'items', COALESCE((
      SELECT jsonb_agg(booking_payload ORDER BY row_num)
      FROM paged
    ), '[]'::jsonb),
    'totalItems', COALESCE((SELECT COUNT(*) FROM filtered), 0)
  );
$$;
