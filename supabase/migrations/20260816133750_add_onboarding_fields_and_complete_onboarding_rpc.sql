alter table public.profiles
  add column country_code text,
  add column base_currency_code text,
  add column selected_goals text[] not null default '{}';

alter table public.profiles
  add constraint profiles_base_currency_code_check
  check (base_currency_code is null or base_currency_code in ('USD', 'SAR', 'EGP', 'EUR', 'GBP'));

comment on column public.profiles.country_code is
  'ISO 3166-1 alpha-2 country code selected during onboarding.';
comment on column public.profiles.base_currency_code is
  'Currency used to display total wealth and reports, selected during onboarding.';
comment on column public.profiles.selected_goals is
  'Financial goal ids selected during onboarding (e.g. buy_home, travel).';

-- New signups now go through the onboarding flow instead of skipping it.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, onboarding_completed)
  values (new.id, new.raw_user_meta_data ->> 'full_name', false)
  on conflict (id) do nothing;
  return new;
end;
$$;

create function public.complete_onboarding(
  p_country_code text,
  p_base_currency_code text,
  p_selected_goals text[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.profiles
  set
    country_code = p_country_code,
    base_currency_code = p_base_currency_code,
    selected_goals = p_selected_goals,
    onboarding_completed = true
  where id = (select auth.uid());

  if not found then
    raise exception 'Profile not found for current user';
  end if;
end;
$$;

comment on function public.complete_onboarding(text, text, text[]) is
  'Saves the authenticated user''s onboarding selections and marks onboarding complete.';

revoke all on function public.complete_onboarding(text, text, text[]) from public, anon;
grant execute on function public.complete_onboarding(text, text, text[]) to authenticated;
