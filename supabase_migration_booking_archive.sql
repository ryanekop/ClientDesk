ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS bookings_user_archived_listing_idx
  ON public.bookings (user_id, archived_at, booking_date DESC, created_at DESC);

CREATE OR REPLACE FUNCTION public.cd_normalize_archive_mode(
  p_archive_mode TEXT DEFAULT 'active'
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(COALESCE(NULLIF(btrim(p_archive_mode), ''), 'active')) = 'archived'
      THEN 'archived'
    ELSE 'active'
  END;
$$;

DROP FUNCTION IF EXISTS public.cd_get_finance_metadata(TEXT);
DROP FUNCTION IF EXISTS public.cd_get_finance_metadata();
DROP FUNCTION IF EXISTS public.cd_get_finance_page(
  INTEGER,
  INTEGER,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  JSONB,
  JSONB,
  BOOLEAN,
  TEXT,
  JSONB,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT
);
DROP FUNCTION IF EXISTS public.cd_get_finance_page(
  INTEGER,
  INTEGER,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  JSONB,
  JSONB,
  BOOLEAN,
  TEXT,
  JSONB,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT
);
DROP FUNCTION IF EXISTS public.cd_get_bookings_metadata(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.cd_get_bookings_metadata(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.cd_get_bookings_page(
  INTEGER,
  INTEGER,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  JSONB,
  JSONB,
  JSONB,
  JSONB,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  JSONB,
  BOOLEAN,
  TEXT
);
DROP FUNCTION IF EXISTS public.cd_get_bookings_page(
  INTEGER,
  INTEGER,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  JSONB,
  JSONB,
  JSONB,
  JSONB,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  JSONB,
  BOOLEAN
);
DROP FUNCTION IF EXISTS public.cd_booking_listing_payload_rows(UUID[]);
DROP FUNCTION IF EXISTS public.cd_booking_listing_filter_rows();
DROP FUNCTION IF EXISTS public.cd_booking_listing_rows();

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
  final_paid_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  archived_by UUID
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
    b.final_paid_at,
    b.archived_at,
    b.archived_by
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
          'duration_minutes', legacy_service.duration_minutes,
          'affects_schedule', legacy_service.affects_schedule,
          'is_addon', legacy_service.is_addon
        )
      END AS legacy_service_json,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', bs.id,
            'kind', COALESCE(bs.kind, 'main'),
            'sort_order', COALESCE(bs.sort_order, 0),
            'quantity', GREATEST(COALESCE(bs.quantity, 1), 1),
            'service', CASE
              WHEN svc.id IS NULL THEN NULL
              ELSE jsonb_build_object(
                'id', svc.id,
                'name', svc.name,
                'price', svc.price,
                'duration_minutes', svc.duration_minutes,
                'affects_schedule', svc.affects_schedule,
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

CREATE OR REPLACE FUNCTION public.cd_booking_listing_filter_rows()
RETURNS TABLE (
  id UUID,
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
  final_paid_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  archived_by UUID
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
    b.final_paid_at,
    b.archived_at,
    b.archived_by
  FROM public.bookings b
  JOIN profile_data ON profile_data.id = b.user_id
  LEFT JOIN public.services legacy_service
    ON legacy_service.id = b.service_id
  LEFT JOIN public.freelance legacy_freelance
    ON legacy_freelance.id = b.freelance_id
  LEFT JOIN LATERAL (
    SELECT
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

CREATE OR REPLACE FUNCTION public.cd_booking_listing_payload_rows(
  p_booking_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  booking_payload JSONB,
  archived_at TIMESTAMPTZ,
  archived_by UUID
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    b.id,
    to_jsonb(b) || jsonb_build_object(
      'services', service_data.legacy_service_json,
      'booking_services', service_data.booking_services_json,
      'freelance', freelance_data.legacy_freelance_json,
      'booking_freelance', freelance_data.booking_freelance_json
    ) AS booking_payload,
    b.archived_at,
    b.archived_by
  FROM public.bookings b
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
          'duration_minutes', legacy_service.duration_minutes,
          'affects_schedule', legacy_service.affects_schedule,
          'is_addon', legacy_service.is_addon
        )
      END AS legacy_service_json,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', bs.id,
            'kind', COALESCE(bs.kind, 'main'),
            'sort_order', COALESCE(bs.sort_order, 0),
            'quantity', GREATEST(COALESCE(bs.quantity, 1), 1),
            'service', CASE
              WHEN svc.id IS NULL THEN NULL
              ELSE jsonb_build_object(
                'id', svc.id,
                'name', svc.name,
                'price', svc.price,
                'duration_minutes', svc.duration_minutes,
                'affects_schedule', svc.affects_schedule,
                'is_addon', svc.is_addon
              )
            END
          )
          ORDER BY CASE WHEN COALESCE(bs.kind, 'main') = 'main' THEN 0 ELSE 1 END,
                   COALESCE(bs.sort_order, 0),
                   COALESCE(svc.name, '')
        ) FILTER (WHERE bs.id IS NOT NULL),
        '[]'::jsonb
      ) AS booking_services_json
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
      ) AS booking_freelance_json
    FROM public.booking_freelance bf
    LEFT JOIN public.freelance f
      ON f.id = bf.freelance_id
    WHERE bf.booking_id = b.id
  ) AS freelance_data ON TRUE
  WHERE b.user_id = auth.uid()
    AND (
      p_booking_ids IS NULL
      OR b.id = ANY(p_booking_ids)
    );
$$;

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
    WHERE (
      (params.archive_mode = 'archived' AND row_data.archived_at IS NOT NULL)
      OR (params.archive_mode <> 'archived' AND row_data.archived_at IS NULL)
    )
      AND (
        params.search_query = ''
        OR public.cd_text_contains(row_data.client_name, params.search_query)
        OR public.cd_text_contains(row_data.booking_code, params.search_query)
        OR public.cd_text_contains(row_data.location, params.search_query)
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

CREATE OR REPLACE FUNCTION public.cd_get_bookings_metadata(
  p_event_type_filter TEXT DEFAULT 'All',
  p_table_menu TEXT DEFAULT 'bookings',
  p_archive_mode TEXT DEFAULT 'active'
) RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH params AS (
    SELECT public.cd_normalize_archive_mode(p_archive_mode) AS archive_mode
  ),
  profile_data AS (
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
    FROM public.cd_booking_listing_filter_rows()
    CROSS JOIN params
    WHERE (
      (params.archive_mode = 'archived' AND archived_at IS NOT NULL)
      OR (params.archive_mode <> 'archived' AND archived_at IS NULL)
    )
  ),
  raw_booking_rows AS (
    SELECT b.event_type, b.extra_fields
    FROM public.bookings b
    CROSS JOIN params
    WHERE b.user_id = auth.uid()
      AND (
        (params.archive_mode = 'archived' AND b.archived_at IS NOT NULL)
        OR (params.archive_mode <> 'archived' AND b.archived_at IS NULL)
      )
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
      SELECT table_column_preferences -> (
        CASE
          WHEN lower(COALESCE(NULLIF(btrim(p_table_menu), ''), 'bookings')) = 'client_status'
            THEN 'client_status'
          ELSE 'bookings'
        END
      )
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
  p_package_filters JSONB DEFAULT '[]'::jsonb,
  p_booking_status_filters JSONB DEFAULT '[]'::jsonb,
  p_export_all BOOLEAN DEFAULT FALSE,
  p_event_type_filter TEXT DEFAULT 'All',
  p_event_type_filters JSONB DEFAULT '[]'::jsonb,
  p_date_from TEXT DEFAULT '',
  p_date_to TEXT DEFAULT '',
  p_date_basis TEXT DEFAULT 'booking_date',
  p_time_zone TEXT DEFAULT 'UTC',
  p_sort_order TEXT DEFAULT 'booking_newest',
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
      public.cd_safe_timezone_name(p_time_zone, 'UTC') AS time_zone,
      COALESCE(NULLIF(btrim(p_sort_order), ''), 'booking_newest') AS sort_order,
      COALESCE(p_export_all, FALSE) AS export_all,
      public.cd_normalize_archive_mode(p_archive_mode) AS archive_mode
  ),
  filtered AS (
    SELECT row_data.*
    FROM public.cd_booking_listing_filter_rows() AS row_data
    CROSS JOIN params
    WHERE (
      (params.archive_mode = 'archived' AND row_data.archived_at IS NOT NULL)
      OR (params.archive_mode <> 'archived' AND row_data.archived_at IS NULL)
    )
      AND (
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

CREATE OR REPLACE FUNCTION public.cd_get_finance_metadata(
  p_archive_mode TEXT DEFAULT 'active'
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH params AS (
    SELECT public.cd_normalize_archive_mode(p_archive_mode) AS archive_mode
  ),
  profile_data AS (
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
    FROM public.cd_booking_listing_filter_rows()
    CROSS JOIN params
    WHERE (
      (params.archive_mode = 'archived' AND archived_at IS NOT NULL)
      OR (params.archive_mode <> 'archived' AND archived_at IS NULL)
    )
  ),
  raw_booking_rows AS (
    SELECT b.event_type, b.extra_fields
    FROM public.bookings b
    CROSS JOIN params
    WHERE b.user_id = auth.uid()
      AND (
        (params.archive_mode = 'archived' AND b.archived_at IS NOT NULL)
        OR (params.archive_mode <> 'archived' AND b.archived_at IS NULL)
      )
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
    FROM public.cd_booking_listing_filter_rows()
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
