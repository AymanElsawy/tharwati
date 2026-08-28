create table public.market_prices (
  id uuid
    constraint market_prices_pkey primary key
    default gen_random_uuid(),
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
  created_at timestamptz
    constraint market_prices_created_at_not_null not null
    default now(),
  constraint market_prices_asset_id_assets_fkey
    foreign key (asset_id)
    references public.assets (id)
    on delete cascade,
  constraint market_prices_currency_code_currencies_fkey
    foreign key (currency_code)
    references public.currencies (code),
  constraint market_prices_provider_not_blank_check
    check (pg_catalog.btrim(provider) <> ''),
  constraint market_prices_price_positive_check
    check (price > 0),
  constraint market_prices_asset_provider_as_of_key
    unique (asset_id, provider, as_of)
);

create index market_prices_asset_as_of_desc_idx
  on public.market_prices (asset_id, as_of desc, id desc);

comment on table public.market_prices is
  'Provider-attributed current price cache. It stores no derived market value, gain/loss, allocation, or return calculation.';

alter table public.market_prices enable row level security;

create policy market_prices_select_visible_assets
on public.market_prices
for select
to authenticated
using (
  exists (
    select 1
    from public.assets
    where assets.id = market_prices.asset_id
      and (
        assets.user_id is null
        or assets.user_id = (select auth.uid())
      )
  )
);

