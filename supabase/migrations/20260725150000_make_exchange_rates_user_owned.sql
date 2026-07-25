alter table public.exchange_rates
  add column user_id uuid,
  add constraint exchange_rates_user_id_auth_users_fkey
    foreign key (user_id)
    references auth.users (id)
    on delete cascade;

-- Existing shared rows have no trustworthy creator metadata. They remain
-- unowned and invisible under RLS instead of being assigned to the wrong user.
alter table public.exchange_rates
  drop constraint exchange_rates_pair_effective_at_key;

alter table public.exchange_rates
  add constraint exchange_rates_user_pair_effective_at_key
  unique (
    user_id,
    base_currency_code,
    quote_currency_code,
    effective_at
  );

create or replace function public.require_exchange_rate_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is null then
    raise exception 'exchange rate user_id is required'
      using errcode = '23502';
  end if;
  return new;
end;
$$;

revoke all on function public.require_exchange_rate_owner()
  from public, anon, authenticated;

create trigger exchange_rates_require_owner
before insert or update on public.exchange_rates
for each row
execute function public.require_exchange_rate_owner();

drop policy exchange_rates_select_authenticated on public.exchange_rates;
drop policy exchange_rates_insert_authenticated on public.exchange_rates;
drop policy exchange_rates_update_authenticated on public.exchange_rates;
drop policy exchange_rates_delete_authenticated on public.exchange_rates;

create policy exchange_rates_select_own
on public.exchange_rates
for select
to authenticated
using (user_id = (select auth.uid()));

create policy exchange_rates_insert_own
on public.exchange_rates
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy exchange_rates_update_own
on public.exchange_rates
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy exchange_rates_delete_own
on public.exchange_rates
for delete
to authenticated
using (user_id = (select auth.uid()));

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
  v_source_currency_code text :=
    pg_catalog.upper(pg_catalog.btrim(p_source_currency_code));
  v_destination_currency_code text :=
    pg_catalog.upper(pg_catalog.btrim(p_destination_currency_code));
begin
  if v_user_id is null then
    raise exception 'authentication is required'
      using errcode = '42501';
  end if;
  if v_source_currency_code !~ '^[A-Z]{3}$'
    or v_destination_currency_code !~ '^[A-Z]{3}$'
    or v_source_currency_code = v_destination_currency_code
    or p_requested_at is null
  then
    raise exception 'invalid historical exchange-rate request'
      using errcode = '22023';
  end if;

  return query
  select er.rate, er.effective_at, er.source, 'direct'::text
  from public.exchange_rates as er
  where er.user_id = v_user_id
    and er.base_currency_code = v_source_currency_code
    and er.quote_currency_code = v_destination_currency_code
    and er.effective_at <= p_requested_at
    and er.rate > 0
  order by er.effective_at desc, er.id desc
  limit 1;
  if found then return; end if;

  return query
  select 1::numeric / er.rate, er.effective_at, er.source, 'inverse'::text
  from public.exchange_rates as er
  where er.user_id = v_user_id
    and er.base_currency_code = v_destination_currency_code
    and er.quote_currency_code = v_source_currency_code
    and er.effective_at <= p_requested_at
    and er.rate > 0
  order by er.effective_at desc, er.id desc
  limit 1;
end;
$$;

comment on function public.resolve_historical_exchange_rate(
  text, text, timestamptz
) is
  'User-owned historical FX resolver. Direct rates take precedence over inverse rates, and only auth.uid() rows are eligible.';
