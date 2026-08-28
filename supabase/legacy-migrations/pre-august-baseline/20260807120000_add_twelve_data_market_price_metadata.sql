alter table public.market_prices
  add column fetched_at timestamptz,
  add column price_type text;

alter table public.market_prices
  add constraint market_prices_price_type_check
  check (
    price_type is null
    or price_type in ('realtime', 'delayed', 'previous_close', 'stale', 'manual')
  );

update public.market_prices
set fetched_at = coalesce(updated_at, created_at),
    price_type = case when provider = 'manual' then 'manual' else 'stale' end
where fetched_at is null or price_type is null;

alter table public.market_prices
  alter column fetched_at set not null,
  alter column price_type set not null;

create index market_prices_provider_cache_idx
  on public.market_prices (asset_id, provider, fetched_at desc, id desc)
  where user_id is null;

comment on column public.market_prices.fetched_at is
  'Time Tharwati successfully fetched and validated the provider price.';

comment on column public.market_prices.price_type is
  'Price provenance: realtime, delayed, previous_close, stale, or manual.';
