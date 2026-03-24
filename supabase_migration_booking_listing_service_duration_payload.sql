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
