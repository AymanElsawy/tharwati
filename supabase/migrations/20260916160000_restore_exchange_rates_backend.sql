create table public.currencies (
  code text primary key,
  name text not null,
  symbol text,
  decimal_places smallint not null default 2,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint currencies_decimal_places_range_check
    check (decimal_places between 0 and 6)
);

insert into public.currencies (code, name, symbol)
values
  ('USD', 'US Dollar', '$'),
  ('SAR', 'Saudi Riyal', 'ر.س'),
  ('EGP', 'Egyptian Pound', 'ج.م'),
  ('EUR', 'Euro', '€'),
  ('GBP', 'British Pound', '£');

alter table public.currencies enable row level security;
revoke all on table public.currencies from public, anon;
grant select on table public.currencies to authenticated, service_role;

create policy currencies_select_active
on public.currencies
for select
to authenticated
using (is_active);

create table public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  base_currency_code text not null references public.currencies (code),
  quote_currency_code text not null references public.currencies (code),
  rate numeric(30, 12) not null,
  effective_at timestamptz not null,
  source text,
  provider text,
  fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exchange_rates_distinct_pair_check
    check (base_currency_code <> quote_currency_code),
  constraint exchange_rates_rate_valid_check
    check (rate > 0 and rate <> 'NaN'::numeric),
  constraint exchange_rates_owner_provenance_check
    check (
      (
        user_id is null
        and provider = 'frankfurter'
        and source = 'frankfurter'
        and fetched_at is not null
      )
      or
      (
        user_id is not null
        and provider is null
        and fetched_at is null
        and source = 'manual'
      )
    )
);

create unique index exchange_rates_manual_pair_effective_key
  on public.exchange_rates (
    user_id,
    base_currency_code,
    quote_currency_code,
    effective_at
  );

create unique index exchange_rates_provider_pair_effective_key
  on public.exchange_rates (
    provider,
    base_currency_code,
    quote_currency_code,
    effective_at
  );

create index exchange_rates_manual_lookup_idx
  on public.exchange_rates (
    user_id,
    base_currency_code,
    quote_currency_code,
    effective_at desc,
    id desc
  )
  where user_id is not null and provider is null;

create index exchange_rates_provider_cache_lookup_idx
  on public.exchange_rates (
    provider,
    base_currency_code,
    quote_currency_code,
    effective_at desc,
    fetched_at desc,
    id desc
  )
  where user_id is null and provider is not null;

create trigger exchange_rates_set_updated_at
before update on public.exchange_rates
for each row execute function public.set_updated_at();

alter table public.exchange_rates enable row level security;

revoke all on table public.exchange_rates from public, anon;
grant select, insert, update, delete on table public.exchange_rates to authenticated;
grant select, insert, update, delete on table public.exchange_rates to service_role;

create policy exchange_rates_select_visible
on public.exchange_rates
for select
to authenticated
using (provider = 'frankfurter' or user_id = (select auth.uid()));

create policy exchange_rates_insert_own_manual
on public.exchange_rates
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and provider is null
  and source = 'manual'
  and fetched_at is null
);

create policy exchange_rates_update_own_manual
on public.exchange_rates
for update
to authenticated
using (user_id = (select auth.uid()) and provider is null)
with check (
  user_id = (select auth.uid())
  and provider is null
  and source = 'manual'
  and fetched_at is null
);

create policy exchange_rates_delete_own_manual
on public.exchange_rates
for delete
to authenticated
using (user_id = (select auth.uid()) and provider is null);

create or replace function public.resolve_historical_exchange_rate(
  p_source_currency_code text,
  p_destination_currency_code text,
  p_requested_at timestamptz
)
returns table (
  rate numeric,
  effective_at timestamptz,
  source text,
  direction text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_source text := pg_catalog.upper(pg_catalog.btrim(p_source_currency_code));
  v_destination text := pg_catalog.upper(pg_catalog.btrim(p_destination_currency_code));
begin
  if v_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;
  if v_source !~ '^[A-Z]{3}$'
    or v_destination !~ '^[A-Z]{3}$'
    or v_source = v_destination
    or p_requested_at is null
  then
    raise exception 'invalid historical exchange-rate request'
      using errcode = '22023';
  end if;

  return query
  select er.rate, er.effective_at, er.source, 'direct'::text
  from public.exchange_rates as er
  where er.provider = 'frankfurter'
    and er.user_id is null
    and er.base_currency_code = v_source
    and er.quote_currency_code = v_destination
    and er.effective_at <= p_requested_at
  order by er.effective_at desc, er.id desc
  limit 1;
  if found then return; end if;

  return query
  select 1::numeric / er.rate, er.effective_at, er.source, 'inverse'::text
  from public.exchange_rates as er
  where er.provider = 'frankfurter'
    and er.user_id is null
    and er.base_currency_code = v_destination
    and er.quote_currency_code = v_source
    and er.effective_at <= p_requested_at
  order by er.effective_at desc, er.id desc
  limit 1;
  if found then return; end if;

  return query
  select er.rate, er.effective_at, er.source, 'direct'::text
  from public.exchange_rates as er
  where er.user_id = v_user_id
    and er.provider is null
    and er.base_currency_code = v_source
    and er.quote_currency_code = v_destination
    and er.effective_at <= p_requested_at
  order by er.effective_at desc, er.id desc
  limit 1;
  if found then return; end if;

  return query
  select 1::numeric / er.rate, er.effective_at, er.source, 'inverse'::text
  from public.exchange_rates as er
  where er.user_id = v_user_id
    and er.provider is null
    and er.base_currency_code = v_destination
    and er.quote_currency_code = v_source
    and er.effective_at <= p_requested_at
  order by er.effective_at desc, er.id desc
  limit 1;
end;
$$;

revoke all on function public.resolve_historical_exchange_rate(text, text, timestamptz)
  from public, anon;
grant execute on function public.resolve_historical_exchange_rate(text, text, timestamptz)
  to authenticated;

comment on table public.exchange_rates is
  'Shared Frankfurter cache rows and authenticated user-owned manual FX fallback rows.';

comment on function public.resolve_historical_exchange_rate(text, text, timestamptz) is
  'Decimal-safe authenticated FX resolver: provider direct/inverse, then caller-owned manual direct/inverse.';
