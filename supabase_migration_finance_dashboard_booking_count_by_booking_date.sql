CREATE OR REPLACE FUNCTION public.cd_get_finance_dashboard(
  p_period TEXT DEFAULT 'all',
  p_time_zone TEXT DEFAULT 'UTC'
) RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH params AS (
    SELECT
      CASE
        WHEN lower(COALESCE(NULLIF(btrim(p_period), ''), 'all')) = 'all' THEN 'all'
        WHEN COALESCE(NULLIF(btrim(p_period), ''), '') ~ '^\d{4}-\d{2}$'
          THEN COALESCE(NULLIF(btrim(p_period), ''), 'all')
        ELSE 'all'
      END AS period_key,
      COALESCE((
        SELECT tz.name
        FROM pg_timezone_names AS tz
        WHERE tz.name = COALESCE(NULLIF(btrim(p_time_zone), ''), 'UTC')
        LIMIT 1
      ), 'UTC') AS time_zone
  ),
  anchors AS (
    SELECT
      params.period_key,
      params.time_zone,
      to_char(timezone(params.time_zone, NOW()), 'YYYY-MM') AS current_period_key,
      CASE
        WHEN params.period_key = 'all'
          THEN date_trunc('month', timezone(params.time_zone, NOW()))::date
        ELSE to_date(params.period_key || '-01', 'YYYY-MM-DD')
      END AS anchor_month
    FROM params
  ),
  booking_rows AS (
    SELECT
      row_data.id,
      row_data.booking_code,
      row_data.client_name,
      row_data.unified_status,
      row_data.main_service_names,
      row_data.service_label,
      row_data.booking_date,
      row_data.created_at,
      row_data.total_price,
      row_data.dp_paid,
      row_data.dp_verified_amount,
      row_data.dp_verified_at,
      row_data.dp_refund_amount,
      row_data.dp_refunded_at,
      row_data.is_fully_paid,
      row_data.settlement_status,
      row_data.final_adjustments,
      row_data.final_payment_amount,
      row_data.final_paid_at,
      row_data.booking_payload -> 'payment_source' AS payment_source,
      row_data.booking_payload -> 'final_payment_source' AS final_payment_source,
      COALESCE(row_data.booking_payload -> 'operational_costs', '[]'::jsonb) AS operational_costs
    FROM public.cd_booking_listing_rows() AS row_data
  ),
  booking_metrics AS (
    SELECT
      booking_rows.*,
      public.cd_net_verified_revenue_amount(
        booking_rows.dp_verified_amount,
        booking_rows.dp_refund_amount,
        booking_rows.final_paid_at,
        booking_rows.is_fully_paid,
        booking_rows.final_payment_amount
      ) AS gross_verified_revenue,
      public.cd_operational_costs_total(booking_rows.operational_costs) AS operational_cost_total,
      public.cd_net_verified_revenue_after_operational_costs(
        booking_rows.dp_verified_amount,
        booking_rows.dp_refund_amount,
        booking_rows.final_paid_at,
        booking_rows.is_fully_paid,
        booking_rows.final_payment_amount,
        booking_rows.operational_costs
      ) AS net_verified_revenue,
      public.cd_remaining_final_payment(
        booking_rows.total_price,
        booking_rows.dp_paid,
        booking_rows.final_adjustments,
        booking_rows.final_paid_at,
        booking_rows.is_fully_paid,
        booking_rows.final_payment_amount
      ) AS remaining_payment
    FROM booking_rows
  ),
  transaction_events AS (
    SELECT
      booking_metrics.id AS booking_id,
      'dp'::text AS event_type,
      public.cd_verified_dp_amount(booking_metrics.dp_verified_amount) AS amount,
      booking_metrics.dp_verified_at AS event_at,
      booking_metrics.payment_source AS source_json,
      to_char(timezone(anchors.time_zone, booking_metrics.dp_verified_at), 'YYYY-MM') AS period_key
    FROM booking_metrics
    CROSS JOIN anchors
    WHERE booking_metrics.dp_verified_at IS NOT NULL
      AND public.cd_verified_dp_amount(booking_metrics.dp_verified_amount) > 0

    UNION ALL

    SELECT
      booking_metrics.id AS booking_id,
      'final'::text AS event_type,
      public.cd_verified_final_payment_amount(
        booking_metrics.final_paid_at,
        booking_metrics.is_fully_paid,
        booking_metrics.final_payment_amount
      ) AS amount,
      booking_metrics.final_paid_at AS event_at,
      booking_metrics.final_payment_source AS source_json,
      to_char(timezone(anchors.time_zone, booking_metrics.final_paid_at), 'YYYY-MM') AS period_key
    FROM booking_metrics
    CROSS JOIN anchors
    WHERE booking_metrics.final_paid_at IS NOT NULL
      AND public.cd_verified_final_payment_amount(
        booking_metrics.final_paid_at,
        booking_metrics.is_fully_paid,
        booking_metrics.final_payment_amount
      ) > 0

    UNION ALL

    SELECT
      booking_metrics.id AS booking_id,
      'refund'::text AS event_type,
      public.cd_dp_refund_amount(
        booking_metrics.dp_refund_amount,
        booking_metrics.dp_verified_amount
      ) * -1 AS amount,
      booking_metrics.dp_refunded_at AS event_at,
      booking_metrics.payment_source AS source_json,
      to_char(timezone(anchors.time_zone, booking_metrics.dp_refunded_at), 'YYYY-MM') AS period_key
    FROM booking_metrics
    CROSS JOIN anchors
    WHERE booking_metrics.dp_refunded_at IS NOT NULL
      AND public.cd_dp_refund_amount(
        booking_metrics.dp_refund_amount,
        booking_metrics.dp_verified_amount
      ) > 0
  ),
  operational_cost_events AS (
    SELECT
      booking_metrics.id AS booking_id,
      COALESCE((item.value ->> 'amount')::numeric, 0) AS amount,
      COALESCE((item.value ->> 'created_at')::timestamptz, NOW()) AS event_at,
      to_char(
        timezone(
          anchors.time_zone,
          COALESCE((item.value ->> 'created_at')::timestamptz, NOW())
        ),
        'YYYY-MM'
      ) AS period_key
    FROM booking_metrics
    CROSS JOIN anchors
    CROSS JOIN LATERAL jsonb_array_elements(
      public.cd_normalize_operational_costs(booking_metrics.operational_costs)
    ) AS item(value)
  ),
  selected_booking_ids AS (
    SELECT DISTINCT booking_id
    FROM transaction_events
    CROSS JOIN anchors
    WHERE anchors.period_key = 'all'
       OR transaction_events.period_key = anchors.period_key

    UNION

    SELECT DISTINCT booking_id
    FROM operational_cost_events
    CROSS JOIN anchors
    WHERE anchors.period_key = 'all'
       OR operational_cost_events.period_key = anchors.period_key
  ),
  selected_transaction_booking_ids AS (
    SELECT DISTINCT booking_id
    FROM transaction_events
    CROSS JOIN anchors
    WHERE anchors.period_key = 'all'
       OR transaction_events.period_key = anchors.period_key
  ),
  selected_bookings AS (
    SELECT booking_metrics.*
    FROM booking_metrics
    CROSS JOIN anchors
    WHERE anchors.period_key = 'all'
       OR booking_metrics.id IN (SELECT booking_id FROM selected_booking_ids)
  ),
  transaction_summary AS (
    SELECT
      COALESCE(SUM(transaction_events.amount), 0) AS gross_revenue,
      COALESCE(SUM(CASE WHEN transaction_events.event_type = 'dp' THEN transaction_events.amount ELSE 0 END), 0) AS verified_dp
    FROM transaction_events
    CROSS JOIN anchors
    WHERE anchors.period_key = 'all'
       OR transaction_events.period_key = anchors.period_key
  ),
  operational_summary AS (
    SELECT COALESCE(SUM(operational_cost_events.amount), 0) AS operational_costs
    FROM operational_cost_events
    CROSS JOIN anchors
    WHERE anchors.period_key = 'all'
       OR operational_cost_events.period_key = anchors.period_key
  ),
  remaining_summary AS (
    SELECT
      COALESCE(SUM(
        CASE
          WHEN selected_bookings.unified_status <> 'Batal'
            THEN selected_bookings.remaining_payment
          ELSE 0
        END
      ), 0) AS total_pending
    FROM selected_bookings
  ),
  booking_count_summary AS (
    SELECT COUNT(*) AS booking_count
    FROM booking_metrics
    CROSS JOIN anchors
    WHERE anchors.period_key = 'all'
       OR to_char(
         COALESCE(
           booking_metrics.booking_date,
           timezone(anchors.time_zone, booking_metrics.created_at)::date
         ),
         'YYYY-MM'
       ) = anchors.period_key
  ),
  source_breakdown AS (
    SELECT
      public.cd_finance_source_key(transaction_events.source_json) AS source_key,
      public.cd_finance_source_label(transaction_events.source_json) AS source_label,
      COALESCE(SUM(transaction_events.amount), 0) AS amount
    FROM transaction_events
    CROSS JOIN anchors
    WHERE anchors.period_key = 'all'
       OR transaction_events.period_key = anchors.period_key
    GROUP BY 1, 2
  ),
  chart_months AS (
    SELECT
      to_char(month_start, 'YYYY-MM') AS period_key
    FROM anchors
    CROSS JOIN LATERAL generate_series(
      anchors.anchor_month::timestamp - INTERVAL '11 months',
      anchors.anchor_month::timestamp,
      INTERVAL '1 month'
    ) AS month_start
  ),
  chart_transaction_summary AS (
    SELECT
      transaction_events.period_key,
      COALESCE(SUM(transaction_events.amount), 0) AS gross_revenue,
      COALESCE(SUM(CASE WHEN transaction_events.event_type = 'dp' THEN transaction_events.amount ELSE 0 END), 0) AS verified_dp
    FROM transaction_events
    GROUP BY transaction_events.period_key
  ),
  chart_operational_summary AS (
    SELECT
      operational_cost_events.period_key,
      COALESCE(SUM(operational_cost_events.amount), 0) AS operational_costs
    FROM operational_cost_events
    GROUP BY operational_cost_events.period_key
  ),
  chart_rows AS (
    SELECT
      chart_months.period_key,
      COALESCE(chart_transaction_summary.gross_revenue, 0) AS gross_revenue,
      COALESCE(chart_transaction_summary.verified_dp, 0) AS verified_dp,
      COALESCE(chart_operational_summary.operational_costs, 0) AS operational_costs,
      COALESCE(chart_transaction_summary.gross_revenue, 0)
        - COALESCE(chart_operational_summary.operational_costs, 0) AS net_revenue
    FROM chart_months
    LEFT JOIN chart_transaction_summary
      ON chart_transaction_summary.period_key = chart_months.period_key
    LEFT JOIN chart_operational_summary
      ON chart_operational_summary.period_key = chart_months.period_key
    ORDER BY chart_months.period_key ASC
  ),
  period_candidates AS (
    SELECT anchors.current_period_key AS period_key
    FROM anchors

    UNION

    SELECT transaction_events.period_key
    FROM transaction_events
    WHERE transaction_events.period_key IS NOT NULL

    UNION

    SELECT operational_cost_events.period_key
    FROM operational_cost_events
    WHERE operational_cost_events.period_key IS NOT NULL
  ),
  top_packages AS (
    SELECT
      package_rows.package_name,
      COUNT(DISTINCT package_rows.booking_id) AS booking_count,
      COALESCE(SUM(package_rows.gross_verified_revenue), 0) AS gross_revenue,
      COALESCE(SUM(package_rows.net_verified_revenue), 0) AS net_revenue
    FROM (
      SELECT
        booking_metrics.id AS booking_id,
        booking_metrics.gross_verified_revenue,
        booking_metrics.net_verified_revenue,
        package_name
      FROM booking_metrics
      JOIN selected_transaction_booking_ids
        ON selected_transaction_booking_ids.booking_id = booking_metrics.id
      CROSS JOIN LATERAL unnest(
        CASE
          WHEN cardinality(booking_metrics.main_service_names) > 0
            THEN booking_metrics.main_service_names
          WHEN COALESCE(NULLIF(booking_metrics.service_label, '-'), '') <> ''
            THEN ARRAY[booking_metrics.service_label]::text[]
          ELSE ARRAY[]::text[]
        END
      ) AS package_name
    ) AS package_rows
    WHERE btrim(package_rows.package_name) <> ''
    GROUP BY package_rows.package_name
    ORDER BY booking_count DESC, gross_revenue DESC, package_rows.package_name ASC
    LIMIT 5
  )
  SELECT jsonb_build_object(
    'selectedPeriod', anchors.period_key,
    'currentPeriod', anchors.current_period_key,
    'availablePeriods', COALESCE((
      SELECT jsonb_agg(period_key ORDER BY period_key DESC)
      FROM period_candidates
    ), '[]'::jsonb),
    'summary', jsonb_build_object(
      'grossRevenue', COALESCE((SELECT gross_revenue FROM transaction_summary), 0),
      'operationalCosts', COALESCE((SELECT operational_costs FROM operational_summary), 0),
      'netRevenue',
        COALESCE((SELECT gross_revenue FROM transaction_summary), 0)
        - COALESCE((SELECT operational_costs FROM operational_summary), 0),
      'verifiedDp', COALESCE((SELECT verified_dp FROM transaction_summary), 0),
      'outstandingBalance', COALESCE((SELECT total_pending FROM remaining_summary), 0),
      'bookingCount', COALESCE((SELECT booking_count FROM booking_count_summary), 0)
    ),
    'sourceBreakdown', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'sourceKey', source_breakdown.source_key,
          'label', source_breakdown.source_label,
          'amount', source_breakdown.amount
        )
        ORDER BY source_breakdown.amount DESC, source_breakdown.source_label ASC
      )
      FROM source_breakdown
    ), '[]'::jsonb),
    'monthlyChart', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'periodKey', chart_rows.period_key,
          'grossRevenue', chart_rows.gross_revenue,
          'verifiedDp', chart_rows.verified_dp,
          'operationalCosts', chart_rows.operational_costs,
          'netRevenue', chart_rows.net_revenue
        )
        ORDER BY chart_rows.period_key ASC
      )
      FROM chart_rows
    ), '[]'::jsonb),
    'topPackages', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'packageName', top_packages.package_name,
          'bookingCount', top_packages.booking_count,
          'grossRevenue', top_packages.gross_revenue,
          'netRevenue', top_packages.net_revenue
        )
        ORDER BY top_packages.booking_count DESC, top_packages.gross_revenue DESC, top_packages.package_name ASC
      )
      FROM top_packages
    ), '[]'::jsonb)
  )
  FROM anchors;
$$;
