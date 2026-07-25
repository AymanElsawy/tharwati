alter table public.profiles
  add column full_name text,
  add column avatar_url text,
  add constraint profiles_full_name_not_blank_check
    check (full_name is null or btrim(full_name) <> ''),
  add constraint profiles_avatar_url_not_blank_check
    check (avatar_url is null or btrim(avatar_url) <> '');

-- Preserve names collected by earlier application versions without changing
-- the legacy display_name field.
update public.profiles
set full_name = btrim(display_name)
where display_name is not null
  and btrim(display_name) <> ''
  and full_name is null;
