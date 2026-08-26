-- Resolve a normalized Twelve Data search result into the existing asset
-- catalog without granting authenticated clients direct identifier writes.

create or replace function public.resolve_external_brokerage_asset(
  p_symbol text,
  p_name text,
  p_mic_code text,
  p_display_exchange text,
  p_country text,
  p_currency_code text,
  p_instrument_type text
)
returns public.assets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_symbol text := upper(btrim(p_symbol));
  v_name text := pg_catalog.regexp_replace(btrim(p_name), '\s+', ' ', 'g');
  v_mic_code text := upper(btrim(p_mic_code));
  v_display_exchange text := pg_catalog.regexp_replace(
    btrim(p_display_exchange), '\s+', ' ', 'g'
  );
  v_country text := pg_catalog.regexp_replace(btrim(p_country), '\s+', ' ', 'g');
  v_currency_code text := upper(btrim(p_currency_code));
  v_instrument_type text := pg_catalog.regexp_replace(
    btrim(p_instrument_type), '\s+', ' ', 'g'
  );
  v_asset_type_code text;
  v_identifier_namespace text;
  v_identifier_asset_id uuid;
  v_asset public.assets%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  if v_symbol is null
    or v_symbol = ''
    or length(v_symbol) > 30
    or v_symbol !~ '^[A-Z0-9][A-Z0-9._:/-]*$' then
    raise exception 'external asset symbol is invalid' using errcode = '22023';
  end if;
  if v_mic_code is null or v_mic_code !~ '^[A-Z0-9]{4}$' then
    raise exception 'external asset MIC code is invalid' using errcode = '22023';
  end if;
  if v_name is null or v_name = '' or length(v_name) > 200 then
    raise exception 'external asset name is invalid' using errcode = '22023';
  end if;
  if v_display_exchange is null
    or v_display_exchange = ''
    or length(v_display_exchange) > 120 then
    raise exception 'external asset display exchange is invalid' using errcode = '22023';
  end if;
  if v_country is null or v_country = '' or length(v_country) > 120 then
    raise exception 'external asset country is invalid' using errcode = '22023';
  end if;
  if v_instrument_type is null
    or v_instrument_type = ''
    or length(v_instrument_type) > 120 then
    raise exception 'external asset instrument type is invalid' using errcode = '22023';
  end if;
  if v_currency_code is null
    or v_currency_code not in ('USD', 'SAR', 'EGP', 'EUR', 'GBP') then
    raise exception 'external asset currency is not supported' using errcode = '22023';
  end if;

  v_asset_type_code := case lower(v_instrument_type)
    when 'common stock' then 'stock'
    when 'preferred stock' then 'stock'
    when 'depositary receipt' then 'stock'
    when 'american depositary receipt' then 'stock'
    when 'global depositary receipt' then 'stock'
    when 'etf' then 'etf'
    when 'exchange-traded fund' then 'etf'
    when 'mutual fund' then 'mutual_fund'
    when 'bond' then 'bond'
    when 'cryptocurrency' then 'cryptocurrency'
    when 'digital currency' then 'cryptocurrency'
    when 'warrant' then 'other'
    else null
  end;

  if v_asset_type_code is null then
    raise exception 'external asset instrument type is not supported'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.asset_types as asset_types
    where asset_types.code = v_asset_type_code
      and asset_types.is_active
  ) then
    raise exception 'external asset type is not available' using errcode = '23514';
  end if;

  v_identifier_namespace := 'twelve_data:' || v_mic_code;

  -- The user-scoped lock makes repeated or concurrent resolution of the same
  -- provider identity converge before either the asset or identifier is made.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_user_id::text || ':' || v_identifier_namespace || ':' || v_symbol,
      0
    )
  );

  select assets.*
  into v_asset
  from public.asset_identifiers as identifiers
  join public.assets as assets on assets.id = identifiers.asset_id
  where identifiers.scheme = 'provider'
    and identifiers.provider = 'twelve_data'
    and lower(btrim(identifiers.namespace)) = lower(v_identifier_namespace)
    and identifiers.normalized_value = v_symbol
    and (assets.user_id is null or assets.user_id = v_user_id)
  order by (assets.user_id is null) desc
  limit 1;

  if v_asset.id is not null then
    if v_asset.currency_code <> v_currency_code
      or v_asset.asset_type_code <> v_asset_type_code then
      raise exception 'existing external asset identity is incompatible'
        using errcode = '23514';
    end if;
    if not v_asset.is_active then
      if v_asset.user_id = v_user_id then
        update public.assets as assets
        set is_active = true
        where assets.id = v_asset.id
        returning assets.* into v_asset;
      else
        raise exception 'existing external asset is inactive' using errcode = '23514';
      end if;
    end if;
    return v_asset;
  end if;

  -- A matching user-owned manual asset can safely acquire the provider
  -- identity. Global catalog rows remain server-managed and are never changed
  -- from client-supplied provider fields.
  select assets.*
  into v_asset
  from public.assets as assets
  where assets.user_id = v_user_id
    and assets.is_custom
    and upper(btrim(assets.symbol)) = v_symbol
    and lower(btrim(coalesce(assets.exchange, ''))) in (
      lower(v_display_exchange), lower(v_mic_code)
    )
  order by case
    when upper(btrim(coalesce(assets.exchange, ''))) = v_mic_code then 0
    else 1
  end
  limit 1
  for update of assets;

  if v_asset.id is not null then
    if v_asset.currency_code <> v_currency_code
      or v_asset.asset_type_code <> v_asset_type_code then
      raise exception 'existing custom asset is incompatible with provider result'
        using errcode = '23514';
    end if;
    if not v_asset.is_active then
      update public.assets as assets
      set is_active = true
      where assets.id = v_asset.id
      returning assets.* into v_asset;
    end if;
  else
    insert into public.assets (
      user_id,
      asset_type_code,
      symbol,
      name,
      currency_code,
      exchange,
      is_custom,
      is_active
    )
    values (
      v_user_id,
      v_asset_type_code,
      v_symbol,
      v_name,
      v_currency_code,
      v_display_exchange,
      true,
      true
    )
    on conflict do nothing
    returning * into v_asset;

    if v_asset.id is null then
      select assets.*
      into v_asset
      from public.assets as assets
      where assets.user_id = v_user_id
        and assets.is_custom
        and upper(btrim(assets.symbol)) = v_symbol
        and lower(btrim(coalesce(assets.exchange, ''))) = lower(v_display_exchange)
      limit 1
      for update of assets;

      if v_asset.id is null
        or v_asset.currency_code <> v_currency_code
        or v_asset.asset_type_code <> v_asset_type_code then
        raise exception 'external asset identity conflicts with an incompatible asset'
          using errcode = '23505';
      end if;
    end if;
  end if;

  insert into public.asset_identifiers (
    asset_id,
    scheme,
    namespace,
    value,
    normalized_value,
    provider,
    is_primary
  )
  values (
    v_asset.id,
    'provider',
    v_identifier_namespace,
    v_symbol,
    v_symbol,
    'twelve_data',
    not exists (
      select 1
      from public.asset_identifiers as identifiers
      where identifiers.asset_id = v_asset.id
        and identifiers.is_primary
    )
  )
  on conflict do nothing;

  select identifiers.asset_id
  into v_identifier_asset_id
  from public.asset_identifiers as identifiers
  where identifiers.user_id = v_user_id
    and identifiers.scheme = 'provider'
    and identifiers.provider = 'twelve_data'
    and lower(btrim(identifiers.namespace)) = lower(v_identifier_namespace)
    and identifiers.normalized_value = v_symbol;

  if v_identifier_asset_id is distinct from v_asset.id then
    raise exception 'external asset provider identity conflicts with another asset'
      using errcode = '23505';
  end if;

  return v_asset;
end;
$$;

revoke all on function public.resolve_external_brokerage_asset(
  text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.resolve_external_brokerage_asset(
  text, text, text, text, text, text, text
) to authenticated;
