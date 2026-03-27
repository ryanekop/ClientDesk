# Staleness Audit SQL Snippets

Jalankan query berikut di SQL Editor environment yang terdampak.

## 1) Verifikasi trigger aktif pada `profiles`/`bookings`

```sql
select
  event_object_table,
  trigger_name,
  action_timing,
  event_manipulation
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table in ('profiles', 'bookings')
order by event_object_table, trigger_name;
```

## 2) Verifikasi definisi function trigger `updated_at`

```sql
select pg_get_functiondef(p.oid)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'set_row_updated_at';
```

## 3) Bukti timestamp sebelum/sesudah perubahan

Ganti placeholder berikut sebelum menjalankan:

- `<user_id>` = UUID user profile
- `<booking_id>` = UUID booking
- `<booking_code>` = code booking
- `<tracking_uuid>` = UUID tracking

```sql
select id, updated_at
from public.profiles
where id = '<user_id>';

select id, booking_code, tracking_uuid, updated_at
from public.bookings
where id = '<booking_id>';

select id, booking_code, tracking_uuid, updated_at
from public.bookings
where booking_code = '<booking_code>';

select id, booking_code, tracking_uuid, updated_at
from public.bookings
where tracking_uuid = '<tracking_uuid>';
```

