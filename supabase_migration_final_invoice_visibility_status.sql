alter table public.profiles
add column if not exists final_invoice_visible_from_status text;

update public.profiles
set final_invoice_visible_from_status = coalesce(final_invoice_visible_from_status, 'Sesi Foto / Acara')
where final_invoice_visible_from_status is null;
