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

comment on function public.prevent_future_market_price() is
  'Rejects future-effective market prices at the database boundary for manual and trusted ingestion paths. Administrative data repair requires explicitly disabling this trigger inside a controlled migration.';

revoke all on function public.prevent_future_market_price()
  from public, anon, authenticated;

create trigger market_prices_10_prevent_future_as_of
before insert or update of as_of on public.market_prices
for each row
execute function public.prevent_future_market_price();

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

comment on function public.get_current_market_price(uuid) is
  'Returns the latest RLS-visible positive price effective at database statement time. Future rows are never current; ties are resolved deterministically by id descending.';

revoke all on function public.get_current_market_price(uuid)
  from public, anon, authenticated;
grant execute on function public.get_current_market_price(uuid)
  to authenticated;
