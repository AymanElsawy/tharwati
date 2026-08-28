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
  v_source_currency_code text :=
    pg_catalog.upper(pg_catalog.btrim(p_source_currency_code));
  v_destination_currency_code text :=
    pg_catalog.upper(pg_catalog.btrim(p_destination_currency_code));
begin
  if v_source_currency_code !~ '^[A-Z]{3}$'
    or v_destination_currency_code !~ '^[A-Z]{3}$'
    or v_source_currency_code = v_destination_currency_code
    or p_requested_at is null
  then
    raise exception 'invalid historical exchange-rate request'
      using errcode = '22023';
  end if;

  -- Direct rates always take precedence. Within a direction, effective_at
  -- and then the UUID provide deterministic latest-rate selection.
  return query
  select
    exchange_rates.rate,
    exchange_rates.effective_at,
    exchange_rates.source,
    'direct'::text
  from public.exchange_rates
  where exchange_rates.base_currency_code = v_source_currency_code
    and exchange_rates.quote_currency_code = v_destination_currency_code
    and exchange_rates.effective_at <= p_requested_at
    and exchange_rates.rate > 0
  order by exchange_rates.effective_at desc, exchange_rates.id desc
  limit 1;

  if found then
    return;
  end if;

  return query
  select
    1::numeric / exchange_rates.rate,
    exchange_rates.effective_at,
    exchange_rates.source,
    'inverse'::text
  from public.exchange_rates
  where exchange_rates.base_currency_code = v_destination_currency_code
    and exchange_rates.quote_currency_code = v_source_currency_code
    and exchange_rates.effective_at <= p_requested_at
    and exchange_rates.rate > 0
  order by exchange_rates.effective_at desc, exchange_rates.id desc
  limit 1;
end;
$$;

comment on function public.resolve_historical_exchange_rate(
  text, text, timestamptz
) is
  'Canonical historical FX resolver. It selects the latest valid direct rate first, falls back to the latest valid inverse rate, uses effective_at and id for deterministic ordering, and never performs multi-hop conversion.';

revoke all on function public.resolve_historical_exchange_rate(
  text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.resolve_historical_exchange_rate(
  text, text, timestamptz
) to authenticated;

create or replace function public.prepare_future_entry_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_occurred_at timestamptz;
  v_transaction_currency text;
  v_account_currency text;
  v_canonical_unit text;
  v_rate numeric;
  v_rate_effective_at timestamptz;
  v_rate_source text;
begin
  select
    status,
    occurred_at,
    transaction_currency_code
  into
    v_status,
    v_occurred_at,
    v_transaction_currency
  from public.financial_transactions
  where id = new.transaction_id;

  if v_status <> 'draft' then
    return new;
  end if;

  select currency_code
  into v_account_currency
  from public.financial_accounts
  where id = new.account_id;

  if new.quantity_delta is not null and new.quantity_delta <> 0 then
    select canonical_quantity_unit
    into v_canonical_unit
    from public.assets
    where id = new.asset_id;

    new.input_quantity := coalesce(
      new.input_quantity,
      new.quantity_delta
    );
    new.input_quantity_unit := coalesce(
      new.input_quantity_unit,
      v_canonical_unit
    );
    new.quantity_conversion_factor :=
      public.quantity_conversion_factor(
        new.input_quantity_unit,
        v_canonical_unit
      );
    new.quantity_delta :=
      new.input_quantity * new.quantity_conversion_factor;
  else
    new.input_quantity := null;
    new.input_quantity_unit := null;
    new.quantity_conversion_factor := null;
  end if;

  if new.cost_basis_delta is null or new.asset_id is null then
    new.account_cost_basis_delta := null;
    new.account_fx_rate := null;
    new.account_fx_effective_at := null;
    new.account_fx_source := null;
    return new;
  end if;

  if v_transaction_currency = v_account_currency then
    new.account_cost_basis_delta := new.cost_basis_delta;
    new.account_fx_rate := 1::numeric;
    new.account_fx_effective_at := v_occurred_at;
    new.account_fx_source := 'identity';
    return new;
  end if;

  select
    resolved.rate,
    resolved.effective_at,
    resolved.source
  into
    v_rate,
    v_rate_effective_at,
    v_rate_source
  from public.resolve_historical_exchange_rate(
    v_transaction_currency,
    v_account_currency,
    v_occurred_at
  ) as resolved;

  if v_rate is null then
    raise exception
      'missing historical exchange rate for % to % at %',
      v_transaction_currency,
      v_account_currency,
      v_occurred_at
      using errcode = 'P0002';
  end if;

  if new.account_amount
    <> new.transaction_amount * v_rate
  then
    raise exception
      'account amount does not match the selected historical rate'
      using errcode = '23514';
  end if;

  new.account_cost_basis_delta :=
    new.cost_basis_delta * v_rate;
  new.account_fx_rate := v_rate;
  new.account_fx_effective_at := v_rate_effective_at;
  new.account_fx_source := coalesce(v_rate_source, 'exchange_rates');
  return new;
end;
$$;

comment on function public.prepare_future_entry_metadata() is
  'Completes canonical quantity and historical account-currency cost metadata for future draft entries only. Cross-currency metadata uses the canonical historical FX resolver; immutable posted legacy entries remain unchanged.';

do $migration$
declare
  v_old_function regprocedure :=
    'public.add_investment(uuid,text,text,text,text,uuid,text,text,text,text,text,text,text,text,text,numeric,numeric,numeric,numeric,timestamptz,text)'::regprocedure;
  v_definition text;
  v_updated_definition text;
  v_old_fx_block text := $old$
  if coalesce(
    nullif(pg_catalog.btrim(p_new_asset_currency_code), ''),
    v_asset.currency_code
  ) = v_account.currency_code then
    v_fx_rate := 1::numeric;
  else
    v_fx_rate := p_account_fx_rate;

    if v_fx_rate is null or v_fx_rate <= 0 then
      raise exception
        'a positive account conversion rate is required for % to %',
        coalesce(
          nullif(pg_catalog.btrim(p_new_asset_currency_code), ''),
          v_asset.currency_code
        ),
        v_account.currency_code
        using errcode = '22023';
    end if;
  end if;$old$;
  v_new_fx_block text := $new$
  if coalesce(
    nullif(pg_catalog.btrim(p_new_asset_currency_code), ''),
    v_asset.currency_code
  ) = v_account.currency_code then
    v_fx_rate := 1::numeric;
  else
    select resolved.rate
    into v_fx_rate
    from public.resolve_historical_exchange_rate(
      coalesce(
        nullif(pg_catalog.btrim(p_new_asset_currency_code), ''),
        v_asset.currency_code
      ),
      v_account.currency_code,
      p_occurred_at
    ) as resolved;

    if v_fx_rate is null then
      raise exception
        'missing historical exchange rate for % to % at %',
        coalesce(
          nullif(pg_catalog.btrim(p_new_asset_currency_code), ''),
          v_asset.currency_code
        ),
        v_account.currency_code,
        p_occurred_at
        using errcode = 'P0002';
    end if;
  end if;$new$;
begin
  select pg_catalog.pg_get_functiondef(v_old_function)
  into v_definition;

  v_updated_definition := pg_catalog.regexp_replace(
    v_definition,
    'p_account_fx_rate numeric, ?',
    '',
    'g'
  );
  if v_updated_definition = v_definition then
    raise exception
      'add_investment account FX parameter did not match the deployed definition';
  end if;

  v_definition := v_updated_definition;
  v_updated_definition := pg_catalog.replace(
    v_definition,
    v_old_fx_block,
    v_new_fx_block
  );
  if v_updated_definition = v_definition then
    raise exception
      'add_investment FX block did not match the deployed definition';
  end if;

  execute v_updated_definition;
end;
$migration$;

revoke all on function public.add_investment(
  uuid, text, text, text, text,
  uuid, text, text, text, text, text,
  text, text, text, text,
  numeric, numeric, numeric,
  timestamptz, text
) from public, anon, authenticated;
grant execute on function public.add_investment(
  uuid, text, text, text, text,
  uuid, text, text, text, text, text,
  text, text, text, text,
  numeric, numeric, numeric,
  timestamptz, text
) to authenticated;

comment on function public.add_investment(
  uuid, text, text, text, text,
  uuid, text, text, text, text, text,
  text, text, text, text,
  numeric, numeric, numeric,
  timestamptz, text
) is
  'Atomically adds and posts a Buy. Historical account FX is resolved exclusively by the database canonical resolver; callers cannot supply a conversion rate.';

drop function public.add_investment(
  uuid, text, text, text, text,
  uuid, text, text, text, text, text,
  text, text, text, text,
  numeric, numeric, numeric, numeric,
  timestamptz, text
);
