alter table public.profiles
add column if not exists form_hide_service_prices boolean default false;

update public.profiles
set form_hide_service_prices = coalesce(form_hide_service_prices, false)
where form_hide_service_prices is null;
