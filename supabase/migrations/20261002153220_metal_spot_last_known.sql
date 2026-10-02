-- Separate server-owned spot quotes. Never securities prices or transaction cost/FX.
create schema if not exists metal_private;
revoke all on schema metal_private from public, anon, authenticated;
create table metal_private.spot_quotes (
  symbol text primary key check (symbol in ('XAU', 'XAG')),
  currency_code text not null check (currency_code = 'USD'),
  price numeric not null check (price > 0 and price::text not in ('NaN','Infinity','-Infinity')),
  provider text not null check (provider = 'gold-api'),
  effective_at timestamptz not null,
  fetched_at timestamptz not null,
  timestamp_basis text not null check (timestamp_basis in ('provider','observed')),
  check (isfinite(effective_at) and isfinite(fetched_at) and effective_at <= fetched_at
    and fetched_at <= clock_timestamp())
);
alter table metal_private.spot_quotes enable row level security;
revoke all on metal_private.spot_quotes from public, anon, authenticated;

-- Global public market quotes contain no account/user data. Authenticated read
-- only; exposing a bounded RPC permits recovery when the Edge transport fails.
create function public.read_metal_spot_quote(p_symbol text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_quote metal_private.spot_quotes%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_symbol is null or p_symbol not in ('XAU','XAG') then
    raise exception 'invalid metal symbol' using errcode='22023';
  end if;
  select * into v_quote from metal_private.spot_quotes
    where symbol=p_symbol and effective_at <= clock_timestamp() and fetched_at <= clock_timestamp();
  if not found then return null; end if;
  return jsonb_build_object('symbol',v_quote.symbol,'price',v_quote.price::text,
    'currency',v_quote.currency_code,'provider',v_quote.provider,
    'effectiveAt',v_quote.effective_at,'fetchedAt',v_quote.fetched_at,
    'timestampBasis',v_quote.timestamp_basis);
end;
$$;
revoke all on function public.read_metal_spot_quote(text) from public, anon;
grant execute on function public.read_metal_spot_quote(text) to authenticated;

create function public.store_metal_spot_quote(p_symbol text, p_price text,
  p_effective_at timestamptz, p_fetched_at timestamptz, p_timestamp_basis text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_symbol is null or p_symbol not in ('XAU','XAG') or p_price is null
    or length(p_price)>128 or p_price !~ '^[0-9]+([.][0-9]+)?$'
    or p_price::numeric <= 0 or p_effective_at is null or p_fetched_at is null
    or p_effective_at > p_fetched_at or p_fetched_at > clock_timestamp()
    or p_timestamp_basis is null or p_timestamp_basis not in ('provider','observed') then
    raise exception 'invalid metal quote' using errcode='22023';
  end if;
  insert into metal_private.spot_quotes as current_quote
    (symbol,currency_code,price,provider,effective_at,fetched_at,timestamp_basis)
    values(p_symbol,'USD',p_price::numeric,'gold-api',p_effective_at,p_fetched_at,p_timestamp_basis)
    on conflict(symbol) do update set price=excluded.price,
      effective_at=excluded.effective_at,fetched_at=excluded.fetched_at,
      timestamp_basis=excluded.timestamp_basis
    where (excluded.effective_at,excluded.fetched_at) >
      (current_quote.effective_at,current_quote.fetched_at);
end;
$$;
revoke all on function public.store_metal_spot_quote(text,text,timestamptz,timestamptz,text)
  from public, anon, authenticated;
grant execute on function public.store_metal_spot_quote(text,text,timestamptz,timestamptz,text) to service_role;
