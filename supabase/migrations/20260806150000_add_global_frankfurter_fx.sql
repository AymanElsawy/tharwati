-- Global provider rates are shared cache records. The two historical unowned
-- rows marked "manual" are transition data: posted entries already retain
-- their resolved FX directly, so archive them before enforcing ownership.
alter table public.exchange_rates
  add column if not exists provider text,
  add column if not exists fetched_at timestamptz;

create table public.exchange_rates_archive (
  like public.exchange_rates including defaults including generated,
  archived_at timestamptz not null default now(),
  archive_reason text not null
);

alter table public.exchange_rates_archive enable row level security;
revoke all on table public.exchange_rates_archive from public, anon, authenticated;

insert into public.exchange_rates_archive (
  id, user_id, base_currency_code, quote_currency_code, rate, effective_at,
  source, created_at, updated_at, provider, fetched_at, archive_reason
)
select
  id, user_id, base_currency_code, quote_currency_code, rate, effective_at,
  source, created_at, updated_at, provider, fetched_at,
  'unowned_manual_transition_row_excluded_from_automatic_fx_resolution'
from public.exchange_rates
where user_id is null
  and pg_catalog.lower(pg_catalog.btrim(coalesce(source, ''))) = 'manual';

delete from public.exchange_rates
where user_id is null
  and pg_catalog.lower(pg_catalog.btrim(coalesce(source, ''))) = 'manual';

alter table public.exchange_rates
  add constraint exchange_rates_owner_provider_check
  check (
    (
      provider = 'frankfurter'
      and user_id is null
      and source = 'frankfurter'
      and fetched_at is not null
    )
    or (
      provider is null
      and user_id is not null
      and (
        source is null
        or pg_catalog.lower(pg_catalog.btrim(source)) not in ('frankfurter', 'provider:frankfurter')
      )
    )
  );

alter table public.exchange_rates
  add constraint exchange_rates_rate_finite_check
  check (rate > 0 and rate <> 'NaN'::numeric);

create unique index if not exists exchange_rates_frankfurter_pair_effective_key
  on public.exchange_rates (provider, base_currency_code, quote_currency_code, effective_at)
  where provider = 'frankfurter';

create or replace function public.require_exchange_rate_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.provider = 'frankfurter' and new.user_id is null then
    if current_setting('request.jwt.claim.role', true) <> 'service_role' then
      raise exception 'provider-owned exchange rates require service_role'
        using errcode = '42501';
    end if;
    new.source := 'frankfurter';
    new.fetched_at := coalesce(new.fetched_at, now());
    return new;
  end if;

  if new.provider is not null or new.user_id is null
    or pg_catalog.lower(pg_catalog.btrim(coalesce(new.source, ''))) in ('frankfurter', 'provider:frankfurter') then
    raise exception 'manual exchange rates must be user-owned and cannot set a provider'
      using errcode = '23502';
  end if;
  return new;
end;
$$;

create or replace function public.resolve_historical_exchange_rate(
  p_source_currency_code text,
  p_destination_currency_code text,
  p_requested_at timestamptz
)
returns table (rate numeric, effective_at timestamptz, source text, direction text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_source text := pg_catalog.upper(pg_catalog.btrim(p_source_currency_code));
  v_destination text := pg_catalog.upper(pg_catalog.btrim(p_destination_currency_code));
  v_user_id uuid := auth.uid();
begin
  if v_source !~ '^[A-Z]{3}$' or v_destination !~ '^[A-Z]{3}$'
    or v_source = v_destination or p_requested_at is null or v_user_id is null then
    raise exception 'invalid historical exchange-rate request' using errcode = '22023';
  end if;

  -- Provider rows are global and always win over reviewed user rows.
  return query select er.rate, er.effective_at, er.source, 'direct'::text
    from public.exchange_rates er
    where er.provider = 'frankfurter' and er.base_currency_code = v_source
      and er.quote_currency_code = v_destination and er.effective_at <= p_requested_at
    order by er.effective_at desc, er.id desc limit 1;
  if found then return; end if;
  return query select 1::numeric / er.rate, er.effective_at, er.source, 'inverse'::text
    from public.exchange_rates er
    where er.provider = 'frankfurter' and er.base_currency_code = v_destination
      and er.quote_currency_code = v_source and er.effective_at <= p_requested_at
    order by er.effective_at desc, er.id desc limit 1;
  if found then return; end if;

  return query select er.rate, er.effective_at, er.source, 'direct'::text
    from public.exchange_rates er
    where er.user_id = v_user_id and er.provider is null and er.base_currency_code = v_source
      and er.quote_currency_code = v_destination and er.effective_at <= p_requested_at
    order by er.effective_at desc, er.id desc limit 1;
  if found then return; end if;
  return query select 1::numeric / er.rate, er.effective_at, er.source, 'inverse'::text
    from public.exchange_rates er
    where er.user_id = v_user_id and er.provider is null and er.base_currency_code = v_destination
      and er.quote_currency_code = v_source and er.effective_at <= p_requested_at
    order by er.effective_at desc, er.id desc limit 1;
end;
$$;

revoke all on function public.resolve_historical_exchange_rate(text, text, timestamptz) from public, anon;
grant execute on function public.resolve_historical_exchange_rate(text, text, timestamptz) to authenticated;
