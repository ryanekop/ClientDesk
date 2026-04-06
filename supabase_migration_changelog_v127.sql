-- ============================================================
-- MIGRATION: Update 1.2.7
-- Jalankan manual di Supabase SQL Editor
-- ============================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS calendar_event_description text;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS calendar_event_description_map jsonb;

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS google_calendar_event_id text;

UPDATE profiles
SET calendar_event_description = COALESCE(
  calendar_event_description,
  'Klien: {{client_name}}' || E'\n' ||
  'Booking: {{booking_code}}' || E'\n' ||
  'Paket: {{service_name}}' || E'\n' ||
  'Tanggal: {{session_date}}' || E'\n' ||
  'Jam: {{session_time}} - {{end_time}}' || E'\n' ||
  'Lokasi: {{location}}'
)
WHERE calendar_event_description IS NULL;

UPDATE profiles
SET calendar_event_description_map = COALESCE(
  calendar_event_description_map,
  jsonb_build_object(
    'Umum',
    COALESCE(
      calendar_event_description,
      'Klien: {{client_name}}' || E'\n' ||
      'Booking: {{booking_code}}' || E'\n' ||
      'Paket: {{service_name}}' || E'\n' ||
      'Tanggal: {{session_date}}' || E'\n' ||
      'Jam: {{session_time}} - {{end_time}}' || E'\n' ||
      'Lokasi: {{location}}'
    )
  )
)
WHERE calendar_event_description_map IS NULL;

UPDATE bookings
SET client_status = status
WHERE client_status IS DISTINCT FROM status;

INSERT INTO changelog (version, title, description, badge, published_at)
SELECT
  '1.2.7',
  'Kalender, Drive, Template, dan Detail Booking Diperbaiki',
  'Perbaikan ini merapikan tampilan form pelunasan, memastikan template pesan benar-benar tersimpan, menyatukan jadwal Google Calendar jadi satu event yang bisa diperbarui, menyesuaikan folder Google Drive dengan pengaturan bertingkat, menambah opsi batal tandai lunas, serta menyamakan status klien dengan status booking utama.',
  'update',
  NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM changelog
  WHERE version = '1.2.7'
);
