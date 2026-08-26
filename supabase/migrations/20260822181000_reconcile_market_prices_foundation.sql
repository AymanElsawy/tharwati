create table public.market_prices (
  id uuid
    constraint market_prices_pkey primary key
    default gen_random_uuid(),
  user_id uuid,
  asset_id uuid
    constraint market_prices_asset_id_not_null not null,
  provider text
    constraint market_prices_provider_not_null not null,
  price numeric(30, 10)
    constraint market_prices_price_not_null not null,
  currency_code text
    constraint market_prices_currency_code_not_null not null,
  as_of timestamptz
    constraint market_prices_as_of_not_null not null,
  fetched_at timestamptz
    constraint market_prices_fetched_at_not_null not null
    default now(),
  price_type text
    constraint market_prices_price_type_not_null not null,
  created_at timestamptz
    constraint market_prices_created_at_not_null not null
    default now(),
  updated_at timestamptz
    constraint market_prices_updated_at_not_null not null
    default now(),
  constraint market_prices_user_id_auth_users_fkey
    foreign key (user_id)
    references auth.users (id)
    on delete cascade,
  constraint market_prices_asset_id_assets_fkey
    foreign key (asset_id)
    references public.assets (id)
    on delete cascade,
  constraint market_prices_currency_code_check
    check (currency_code in ('USD', 'SAR', 'EGP', 'EUR', 'GBP')),
  constraint market_prices_provider_not_blank_check
    check (pg_catalog.btrim(provider) <> ''),
  constraint market_prices_price_positive_check
    check (price > 0),
  constraint market_prices_price_type_check
    check (price_type in ('realtime', 'delayed', 'previous_close', 'stale', 'manual')),
  constraint market_prices_owner_asset_provider_as_of_key
    unique nulls not distinct (user_id, asset_id, provider, as_of)
);

create index market_prices_asset_as_of_desc_idx
  on public.market_prices (asset_id, as_of desc, id desc);

create index market_prices_user_asset_as_of_desc_idx
  on public.market_prices (user_id, asset_id, as_of desc, id desc);

create index market_prices_provider_cache_idx
  on public.market_prices (asset_id, provider, fetched_at desc, id desc)
  where user_id is null;

comment on table public.market_prices is
  'Provider-attributed current price cache and user-owned manual fallback prices. It stores no derived valuation or performance data.';

comment on column public.market_prices.user_id is
  'Null identifies trusted shared provider cache rows. Non-null rows are user-owned manual prices protected by RLS.';

comment on column public.market_prices.fetched_at is
  'Time Tharwati successfully fetched and validated the provider price.';

comment on column public.market_prices.price_type is
  'Price provenance: realtime, delayed, previous_close, stale, or manual.';

create or replace function public.prepare_market_price_metadata()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.fetched_at := coalesce(new.fetched_at, pg_catalog.statement_timestamp());
  new.price_type := coalesce(
    new.price_type,
    case when new.provider = 'manual' then 'manual' else 'stale' end
  );

  if new.provider = 'manual' and new.price_type <> 'manual' then
    raise exception 'Manual market prices must use manual provenance.'
      using errcode = '23514', constraint = 'market_prices_manual_price_type_check';
  end if;

  return new;
end;
$$;

revoke all on function public.prepare_market_price_metadata()
  from public, anon, authenticated;

create trigger market_prices_05_prepare_metadata
before insert or update of provider, fetched_at, price_type on public.market_prices
for each row
execute function public.prepare_market_price_metadata();

create or replace function public.prevent_future_market_price()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.as_of > pg_catalog.statement_timestamp() then
    raise exception 'Market price date cannot be in the future.'
      using
        errcode = '23514',
        constraint = 'market_prices_as_of_not_future_check';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_future_market_price()
  from public, anon, authenticated;

create trigger market_prices_10_prevent_future_as_of
before insert or update of as_of on public.market_prices
for each row
execute function public.prevent_future_market_price();

create trigger market_prices_set_updated_at
before update on public.market_prices
for each row
execute function public.set_updated_at();

alter table public.market_prices enable row level security;

create policy market_prices_select_visible_or_owned
on public.market_prices
for select
to authenticated
using (
  (user_id is null or user_id = (select auth.uid()))
  and exists (
    select 1
    from public.assets
    where assets.id = market_prices.asset_id
      and (assets.user_id is null or assets.user_id = (select auth.uid()))
  )
);

create policy market_prices_insert_own_manual
on public.market_prices
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and provider = 'manual'
  and price_type = 'manual'
  and exists (
    select 1
    from public.assets
    where assets.id = market_prices.asset_id
      and (assets.user_id is null or assets.user_id = (select auth.uid()))
  )
);

create policy market_prices_update_own_manual
on public.market_prices
for update
to authenticated
using (
  user_id = (select auth.uid())
  and provider = 'manual'
)
with check (
  user_id = (select auth.uid())
  and provider = 'manual'
  and price_type = 'manual'
  and exists (
    select 1
    from public.assets
    where assets.id = market_prices.asset_id
      and (assets.user_id is null or assets.user_id = (select auth.uid()))
  )
);

create policy market_prices_delete_own_manual
on public.market_prices
for delete
to authenticated
using (
  user_id = (select auth.uid())
  and provider = 'manual'
);

revoke all on table public.market_prices from public, anon;
grant select, insert, update, delete on table public.market_prices to authenticated;
grant select, insert, update, delete on table public.market_prices to service_role;

create or replace function public.get_current_market_price(
  p_asset_id uuid
)
returns setof public.market_prices
language sql
stable
security invoker
set search_path = ''
as $$
  select prices.*
  from public.market_prices as prices
  where prices.asset_id = p_asset_id
    and prices.price > 0
    and prices.as_of <= pg_catalog.statement_timestamp()
  order by prices.as_of desc, prices.id desc
  limit 1;
$$;

revoke all on function public.get_current_market_price(uuid)
  from public, anon, authenticated;
grant execute on function public.get_current_market_price(uuid)
  to authenticated;

comment on function public.get_current_market_price(uuid) is
  'Returns the latest RLS-visible positive price effective at database statement time.';
