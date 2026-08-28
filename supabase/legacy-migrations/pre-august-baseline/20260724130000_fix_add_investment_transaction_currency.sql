do $migration$
declare
  v_function_oid regprocedure :=
    'public.add_investment(uuid,text,text,text,text,uuid,text,text,text,text,text,text,text,text,text,numeric,numeric,numeric,numeric,timestamptz,text)'::regprocedure;
  v_definition text;
  v_updated_definition text;
  v_old_fx_block text := $old$
  if v_asset.currency_code = v_account.currency_code then
    v_fx_rate := 1::numeric;
  else
    v_fx_rate := p_account_fx_rate;

    if v_fx_rate is null or v_fx_rate <= 0 then
      raise exception
        'a positive account conversion rate is required for % to %',
        v_asset.currency_code,
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
  end if;$new$;
  v_old_transaction_currency text := $old$
    'buy',
    v_asset.currency_code,
    'draft',$old$;
  v_new_transaction_currency text := $new$
    'buy',
    coalesce(
      nullif(pg_catalog.btrim(p_new_asset_currency_code), ''),
      v_asset.currency_code
    ),
    'draft',$new$;
begin
  select pg_catalog.pg_get_functiondef(v_function_oid)
  into v_definition;

  v_updated_definition := pg_catalog.replace(
    v_definition,
    v_old_fx_block,
    v_new_fx_block
  );

  if v_updated_definition = v_definition then
    raise exception
      'add_investment FX block did not match the approved definition';
  end if;

  v_definition := v_updated_definition;
  v_updated_definition := pg_catalog.replace(
    v_definition,
    v_old_transaction_currency,
    v_new_transaction_currency
  );

  if v_updated_definition = v_definition then
    raise exception
      'add_investment transaction currency block did not match the approved definition';
  end if;

  execute v_updated_definition;
end;
$migration$;

comment on function public.add_investment(
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  numeric,
  timestamptz,
  text
) is
  'Atomically adds and posts a Buy. For a newly entered asset, the submitted currency remains the immutable transaction currency even when canonical identity reuse resolves an existing catalog asset with a different catalog currency.';

