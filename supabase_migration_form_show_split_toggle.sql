alter table public.profiles
add column if not exists form_show_wedding_split boolean default true;

alter table public.profiles
add column if not exists form_show_wisuda_split boolean default true;

update public.profiles
set
  form_show_wedding_split = coalesce(form_show_wedding_split, true),
  form_show_wisuda_split = coalesce(form_show_wisuda_split, true)
where form_show_wedding_split is null
   or form_show_wisuda_split is null;
