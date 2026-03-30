-- Cleanup massal: hapus metadata universitas dari booking non-Wisuda.
-- Idempotent: aman dijalankan berulang kali.

UPDATE bookings
SET extra_fields = NULLIF(
  (
    COALESCE(extra_fields, '{}'::jsonb)
    - 'universitas'
    - 'universitas_ref_id'
    - 'universitas_abbreviation_draft'
  ),
  '{}'::jsonb
)
WHERE extra_fields IS NOT NULL
  AND (
    extra_fields ? 'universitas'
    OR extra_fields ? 'universitas_ref_id'
    OR extra_fields ? 'universitas_abbreviation_draft'
  )
  AND COALESCE(LOWER(TRIM(event_type)), '') <> 'wisuda';
