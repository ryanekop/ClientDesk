alter table profiles
add column if not exists form_show_addons boolean default true;

update profiles
set form_show_addons = coalesce(form_show_addons, true)
where form_show_addons is null;
