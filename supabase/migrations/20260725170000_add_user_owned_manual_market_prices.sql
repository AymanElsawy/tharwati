alter table public.market_prices
  add column user_id uuid,
  add column updated_at timestamptz
    constraint market_prices_updated_at_not_null not null
    default now(),
  add constraint market_prices_user_id_auth_users_fkey
    foreign key (user_id)
    references auth.users (id)
    on delete cascade;

alter table public.market_prices
  drop constraint market_prices_asset_provider_as_of_key;

alter table public.market_prices
  add constraint market_prices_owner_asset_provider_as_of_key
  unique nulls not distinct (user_id, asset_id, provider, as_of);

create index market_prices_user_asset_as_of_desc_idx
  on public.market_prices (user_id, asset_id, as_of desc, id desc);

drop policy market_prices_select_visible_assets
on public.market_prices;

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
      and (
        assets.user_id is null
        or assets.user_id = (select auth.uid())
      )
  )
);

create policy market_prices_insert_own_manual
on public.market_prices
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and provider = 'manual'
  and exists (
    select 1
    from public.assets
    where assets.id = market_prices.asset_id
      and (
        assets.user_id is null
        or assets.user_id = (select auth.uid())
      )
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
  and exists (
    select 1
    from public.assets
    where assets.id = market_prices.asset_id
      and (
        assets.user_id is null
        or assets.user_id = (select auth.uid())
      )
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

create trigger market_prices_set_updated_at
before update on public.market_prices
for each row
execute function public.set_updated_at();

comment on column public.market_prices.user_id is
  'Null identifies trusted shared provider cache rows. Non-null rows are user-owned manual prices protected by RLS.';
