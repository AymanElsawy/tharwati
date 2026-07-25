alter table public.profiles
  add column country_code text,
  add column selected_goals text[]
    constraint profiles_selected_goals_not_null not null
    default '{}',
  add column onboarding_completed boolean
    constraint profiles_onboarding_completed_not_null not null
    default false,
  add constraint profiles_country_code_format_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$');

create or replace function public.complete_onboarding(
  p_country_code text,
  p_base_currency_code text,
  p_selected_goals text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required to complete onboarding';
  end if;

  if p_country_code is null or p_country_code !~ '^[A-Z]{2}$' then
    raise exception using
      errcode = '23514',
      message = 'A valid ISO country code is required';
  end if;

  if p_base_currency_code is null or not exists (
    select 1
    from public.currencies
    where code = p_base_currency_code
      and is_active
  ) then
    raise exception using
      errcode = '23514',
      message = 'An active base currency is required';
  end if;

  if p_selected_goals is null or cardinality(p_selected_goals) = 0 then
    raise exception using
      errcode = '23514',
      message = 'At least one onboarding goal is required';
  end if;

  update public.profiles
  set
    country_code = p_country_code,
    default_currency_code = p_base_currency_code,
    selected_goals = p_selected_goals,
    onboarding_completed = true
  where id = v_user_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'The authenticated user profile was not found';
  end if;

  update public.financial_settings
  set reporting_currency_code = p_base_currency_code
  where user_id = v_user_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'The authenticated user financial settings were not found';
  end if;
end;
$$;

comment on function public.complete_onboarding(text, text, text[]) is
  'Atomically completes onboarding for auth.uid(). SECURITY DEFINER permits updating both bootstrapped user-owned records; the function accepts no ownership identifier and uses an empty search_path.';

revoke all on function public.complete_onboarding(text, text, text[]) from public;
revoke all on function public.complete_onboarding(text, text, text[]) from anon;
revoke all on function public.complete_onboarding(text, text, text[]) from authenticated;
grant execute on function public.complete_onboarding(text, text, text[]) to authenticated;
