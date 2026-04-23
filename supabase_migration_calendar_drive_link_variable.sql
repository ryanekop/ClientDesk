-- ============================================================
-- MIGRATION: Add Drive link variable to default calendar descriptions
-- Run this SQL in Supabase SQL Editor
-- ============================================================

WITH template_defaults AS (
  SELECT
    ARRAY[
      'Klien: {{client_name}}' || E'\n' ||
      'Booking: {{booking_code}}' || E'\n' ||
      'Paket: {{service_name}}' || E'\n' ||
      'Tanggal: {{session_date}}' || E'\n' ||
      'Jam: {{session_time}} - {{end_time}}' || E'\n' ||
      'Lokasi: {{location}}',
      'Klien: {{client_name}}' || E'\n' ||
      'WhatsApp: {{client_whatsapp}}' || E'\n' ||
      'Booking: {{booking_code}}' || E'\n' ||
      'Detail Booking: {{booking_detail_link}}' || E'\n' ||
      'Paket: {{service_name}}' || E'\n' ||
      'Tanggal: {{session_date}}' || E'\n' ||
      'Jam: {{session_time}} - {{end_time}}' || E'\n' ||
      'Tipe Acara: {{event_type}}' || E'\n' ||
      'Lokasi: {{location}}' || E'\n' ||
      'Maps: {{location_maps_url}}' || E'\n' ||
      'Detail Lokasi: {{detail_location}}' || E'\n' ||
      'Catatan: {{notes}}',
      'Klien: {{client_name}}' || E'\n' ||
      'WhatsApp: {{client_whatsapp}}' || E'\n' ||
      'Booking: {{booking_code}}' || E'\n' ||
      'Detail Booking: {{booking_detail_link}}' || E'\n' ||
      'Paket: {{service_name}}' || E'\n' ||
      'Jadwal:' || E'\n' ||
      '- Akad: {{akad_date}} {{akad_time}} di {{akad_location}}' || E'\n' ||
      '- Resepsi: {{resepsi_date}} {{resepsi_time}} di {{resepsi_location}}' || E'\n' ||
      'Tipe Acara: {{event_type}}' || E'\n' ||
      'Lokasi Utama: {{location}}' || E'\n' ||
      'Maps: {{location_maps_url}}' || E'\n' ||
      'Detail Lokasi: {{detail_location}}' || E'\n' ||
      'Catatan: {{notes}}',
      'Klien: {{client_name}}' || E'\n' ||
      'WhatsApp: {{client_whatsapp}}' || E'\n' ||
      'Booking: {{booking_code}}' || E'\n' ||
      'Detail Booking: {{booking_detail_link}}' || E'\n' ||
      'Paket: {{service_name}}' || E'\n' ||
      'Jadwal:' || E'\n' ||
      '- Sesi 1: {{wisuda_session_1_date}} {{wisuda_session_1_time_range}} di {{wisuda_session_1_location}}' || E'\n' ||
      '- Sesi 2: {{wisuda_session_2_date}} {{wisuda_session_2_time_range}} di {{wisuda_session_2_location}}' || E'\n' ||
      'Tipe Acara: {{event_type}}' || E'\n' ||
      'Lokasi Utama: {{location}}' || E'\n' ||
      'Maps: {{location_maps_url}}' || E'\n' ||
      'Detail Lokasi: {{detail_location}}' || E'\n' ||
      'Catatan: {{notes}}'
    ] AS default_values
),
updated_descriptions AS (
  UPDATE public.profiles
  SET calendar_event_description =
    CASE
      WHEN calendar_event_description = (SELECT default_values[1] FROM template_defaults)
        THEN calendar_event_description || E'\n' || 'Link Drive: {{drive_link}}'
      ELSE regexp_replace(
        calendar_event_description,
        E'\nCatatan: \\{\\{notes\\}\\}$',
        E'\nLink Drive: {{drive_link}}\nCatatan: {{notes}}'
      )
    END
  WHERE calendar_event_description IS NOT NULL
    AND calendar_event_description NOT LIKE '%{{drive_link}}%'
    AND calendar_event_description = ANY((SELECT default_values FROM template_defaults))
  RETURNING id
)
UPDATE public.profiles AS p
SET calendar_event_description_map = mapped.next_map
FROM (
  SELECT
    p.id,
    jsonb_object_agg(
      entry.key,
      to_jsonb(
        CASE
          WHEN entry.value_text LIKE '%{{drive_link}}%' THEN entry.value_text
          WHEN entry.value_text = (SELECT default_values[1] FROM template_defaults)
            THEN entry.value_text || E'\n' || 'Link Drive: {{drive_link}}'
          WHEN entry.value_text = ANY((SELECT default_values FROM template_defaults))
            THEN regexp_replace(
              entry.value_text,
              E'\nCatatan: \\{\\{notes\\}\\}$',
              E'\nLink Drive: {{drive_link}}\nCatatan: {{notes}}'
            )
          ELSE entry.value_text
        END
      )
    ) AS next_map
  FROM public.profiles AS p
  CROSS JOIN LATERAL jsonb_each_text(
    CASE
      WHEN jsonb_typeof(p.calendar_event_description_map) = 'object'
        THEN p.calendar_event_description_map
      ELSE '{}'::jsonb
    END
  ) AS entry(key, value_text)
  WHERE p.calendar_event_description_map IS NOT NULL
    AND jsonb_typeof(p.calendar_event_description_map) = 'object'
  GROUP BY p.id
) AS mapped
WHERE p.id = mapped.id
  AND p.calendar_event_description_map IS DISTINCT FROM mapped.next_map;
