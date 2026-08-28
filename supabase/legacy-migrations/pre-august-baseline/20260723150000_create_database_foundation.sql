create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Sets updated_at for rows modified through tables that use this trigger.';

create table public.currencies (
  code text
    constraint currencies_pkey primary key,
  name text
    constraint currencies_name_not_null not null,
  symbol text,
  decimal_places smallint
    constraint currencies_decimal_places_not_null not null
    default 2,
  is_active boolean
    constraint currencies_is_active_not_null not null
    default true,
  created_at timestamptz
    constraint currencies_created_at_not_null not null
    default now(),
  constraint currencies_decimal_places_range_check
    check (decimal_places between 0 and 6)
);

create table public.profiles (
  id uuid
    constraint profiles_pkey primary key,
  display_name text,
  default_currency_code text
    constraint profiles_default_currency_code_not_null not null
    default 'USD',
  timezone text
    constraint profiles_timezone_not_null not null
    default 'UTC',
  created_at timestamptz
    constraint profiles_created_at_not_null not null
    default now(),
  updated_at timestamptz
    constraint profiles_updated_at_not_null not null
    default now(),
  constraint profiles_id_auth_users_fkey
    foreign key (id)
    references auth.users (id)
    on delete cascade
);

create table public.financial_settings (
  id uuid
    constraint financial_settings_pkey primary key
    default gen_random_uuid(),
  user_id uuid
    constraint financial_settings_user_id_not_null not null,
  reporting_currency_code text
    constraint financial_settings_reporting_currency_code_not_null not null
    default 'USD',
  retirement_target_amount numeric(20, 2),
  retirement_target_date date,
  monthly_contribution_target numeric(20, 2),
  created_at timestamptz
    constraint financial_settings_created_at_not_null not null
    default now(),
  updated_at timestamptz
    constraint financial_settings_updated_at_not_null not null
    default now(),
  constraint financial_settings_user_id_key
    unique (user_id),
  constraint financial_settings_user_id_auth_users_fkey
    foreign key (user_id)
    references auth.users (id)
    on delete cascade,
  constraint financial_settings_retirement_target_amount_non_negative_check
    check (
      retirement_target_amount is null
      or retirement_target_amount >= 0
    ),
  constraint financial_settings_monthly_contribution_target_non_negative_check
    check (
      monthly_contribution_target is null
      or monthly_contribution_target >= 0
    )
);

create table public.exchange_rates (
  id uuid
    constraint exchange_rates_pkey primary key
    default gen_random_uuid(),
  base_currency_code text
    constraint exchange_rates_base_currency_code_not_null not null,
  quote_currency_code text
    constraint exchange_rates_quote_currency_code_not_null not null,
  rate numeric(30, 12)
    constraint exchange_rates_rate_not_null not null,
  effective_at timestamptz
    constraint exchange_rates_effective_at_not_null not null,
  source text,
  created_at timestamptz
    constraint exchange_rates_created_at_not_null not null
    default now(),
  constraint exchange_rates_base_currency_code_currencies_fkey
    foreign key (base_currency_code)
    references public.currencies (code),
  constraint exchange_rates_quote_currency_code_currencies_fkey
    foreign key (quote_currency_code)
    references public.currencies (code),
  constraint exchange_rates_rate_positive_check
    check (rate > 0),
  constraint exchange_rates_distinct_currency_pair_check
    check (base_currency_code <> quote_currency_code),
  constraint exchange_rates_pair_effective_at_key
    unique (base_currency_code, quote_currency_code, effective_at)
);

create index exchange_rates_pair_effective_at_desc_idx
  on public.exchange_rates (
    base_currency_code,
    quote_currency_code,
    effective_at desc
  );

insert into public.currencies (code, name, symbol)
values
  ('USD', 'US Dollar', '$'),
  ('SAR', 'Saudi Riyal', 'ر.س'),
  ('EGP', 'Egyptian Pound', 'ج.م'),
  ('EUR', 'Euro', '€'),
  ('GBP', 'British Pound', '£')
on conflict (code) do update
set
  name = excluded.name,
  symbol = excluded.symbol;

alter table public.profiles
  add constraint profiles_default_currency_code_currencies_fkey
  foreign key (default_currency_code)
  references public.currencies (code);

alter table public.financial_settings
  add constraint financial_settings_reporting_currency_code_currencies_fkey
  foreign key (reporting_currency_code)
  references public.currencies (code);

insert into public.profiles (id)
select id
from auth.users
on conflict (id) do nothing;

insert into public.financial_settings (user_id)
select id
from auth.users
on conflict (user_id) do nothing;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger financial_settings_set_updated_at
before update on public.financial_settings
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.financial_settings enable row level security;
alter table public.currencies enable row level security;
alter table public.exchange_rates enable row level security;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

create policy profiles_update_own
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy financial_settings_select_own
on public.financial_settings
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy financial_settings_insert_own
on public.financial_settings
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy financial_settings_update_own
on public.financial_settings
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy financial_settings_delete_own
on public.financial_settings
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy currencies_select_active
on public.currencies
for select
to authenticated
using (is_active);

create policy exchange_rates_select_authenticated
on public.exchange_rates
for select
to authenticated
using (true);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  insert into public.financial_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Bootstraps private user-owned rows. SECURITY DEFINER is required because auth.users inserts do not run as the new authenticated user; all objects are schema-qualified and search_path is empty.';

-- Trigger functions do not need to be directly executable by client roles.
revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();
