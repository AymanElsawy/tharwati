create unique index financial_accounts_external_investment_funding_key
on public.financial_accounts (user_id, currency_code)
where notes = 'system:external_investment_funding';

do $migration$
declare
  v_definition text;
begin
  select pg_catalog.pg_get_functiondef(procedure.oid)
  into v_definition
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'add_investment'
    and pg_catalog.pg_get_function_identity_arguments(procedure.oid) =
      'p_account_id uuid, p_new_account_type_code text, p_new_account_name text, p_new_account_currency_code text, p_asset_id uuid, p_new_asset_type_code text, p_new_asset_name text, p_new_asset_symbol text, p_new_asset_currency_code text, p_new_asset_exchange text, p_identifier_scheme text, p_identifier_namespace text, p_identifier_value text, p_identifier_provider text, p_quantity numeric, p_unit_price numeric, p_fees numeric, p_occurred_at timestamp with time zone, p_notes text';

  if v_definition is null then
    raise exception 'expected add_investment signature was not found';
  end if;

  v_definition := pg_catalog.replace(
    v_definition,
    E'  p_identifier_provider text,\n  p_quantity numeric,',
    E'  p_identifier_provider text,\n  p_funding_mode text,\n  p_funding_account_id uuid,\n  p_quantity numeric,'
  );
  v_definition := pg_catalog.replace(
    v_definition,
    E'  v_account public.financial_accounts%rowtype;\n',
    E'  v_account public.financial_accounts%rowtype;\n  v_funding_account public.financial_accounts%rowtype;\n  v_funding_fx_rate numeric;\n  v_available_funding numeric;\n'
  );
  v_definition := pg_catalog.replace(
    v_definition,
    E'  insert into public.financial_transactions (',
    E'  if p_funding_mode = ''external'' then\n    if p_funding_account_id is not null then\n      raise exception ''external funding cannot specify a funding account'' using errcode = ''22023'';\n    end if;\n\n    insert into public.financial_accounts (\n      user_id, account_type_code, name, currency_code, opening_balance, notes, is_active\n    ) values (\n      v_user_id, ''other'', ''External investment funding'',\n      v_asset.currency_code, 0::numeric, ''system:external_investment_funding'', false\n    )\n    on conflict (user_id, currency_code)\n      where notes = ''system:external_investment_funding''\n    do update set name = excluded.name\n    returning * into v_funding_account;\n    v_funding_fx_rate := 1::numeric;\n  elsif p_funding_mode = ''cash_account'' then\n    if p_funding_account_id is null then\n      raise exception ''a funding cash account is required'' using errcode = ''22023'';\n    end if;\n\n    select * into v_funding_account\n    from public.financial_accounts\n    where id = p_funding_account_id\n      and user_id = v_user_id\n      and is_active\n      and account_type_code in (''cash'', ''bank'', ''deposit'')\n    for update;\n    if not found then\n      raise exception ''selected funding cash account is not available'' using errcode = ''42501'';\n    end if;\n\n    if v_funding_account.currency_code = v_asset.currency_code then\n      v_funding_fx_rate := 1::numeric;\n    else\n      select rate into v_funding_fx_rate\n      from public.resolve_historical_exchange_rate(\n        v_asset.currency_code, v_funding_account.currency_code, p_occurred_at\n      );\n      if v_funding_fx_rate is null or v_funding_fx_rate <= 0 then\n        raise exception ''a historical funding-account exchange rate is required'' using errcode = ''P0002'';\n      end if;\n    end if;\n\n    select accounts.opening_balance + coalesce(sum(\n      case entries.entry_side when ''debit'' then entries.account_amount else -entries.account_amount end\n    ) filter (where transactions.status = ''posted''), 0::numeric)\n    into v_available_funding\n    from public.financial_accounts as accounts\n    left join public.transaction_entries as entries\n      on entries.account_id = accounts.id and entries.asset_id is null\n    left join public.financial_transactions as transactions\n      on transactions.id = entries.transaction_id and transactions.user_id = accounts.user_id\n    where accounts.id = v_funding_account.id\n    group by accounts.opening_balance;\n    if v_available_funding < v_total_amount * v_funding_fx_rate then\n      raise exception ''insufficient funding account balance'' using errcode = ''P0002'';\n    end if;\n  else\n    raise exception ''funding mode must be external or cash_account'' using errcode = ''22023'';\n  end if;\n\n  insert into public.financial_transactions ('
  );
  v_definition := pg_catalog.replace(
    v_definition,
    E'    v_account.id,\n    ''credit'',\n    v_total_amount,\n    v_total_amount * v_fx_rate,\n    ''investment_payment''',
    E'    v_funding_account.id,\n    ''credit'',\n    v_total_amount,\n    v_total_amount * v_funding_fx_rate,\n    case when p_funding_mode = ''external'' then ''investment_external_funding'' else ''investment_payment'' end'
  );

  if pg_catalog.strpos(v_definition, 'p_funding_mode text') = 0
    or pg_catalog.strpos(v_definition, 'v_funding_account.id') = 0
  then
    raise exception 'add_investment funding transformation failed';
  end if;
  execute v_definition;
end;
$migration$;

drop function public.add_investment(
  uuid, text, text, text, uuid, text, text, text, text, text,
  text, text, text, text, numeric, numeric, numeric, timestamptz, text
);

revoke all on function public.add_investment(
  uuid, text, text, text, uuid, text, text, text, text, text,
  text, text, text, text, text, uuid, numeric, numeric, numeric, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.add_investment(
  uuid, text, text, text, uuid, text, text, text, text, text,
  text, text, text, text, text, uuid, numeric, numeric, numeric, timestamptz, text
) to authenticated;

do $migration$
declare
  v_definition text;
begin
  select pg_catalog.pg_get_functiondef(procedure.oid) into v_definition
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public' and procedure.proname = 'edit_investment'
    and pg_catalog.pg_get_function_identity_arguments(procedure.oid) =
      'p_transaction_id uuid, p_quantity numeric, p_unit_price numeric, p_fees numeric, p_occurred_at timestamp with time zone, p_notes text';
  if v_definition is null then raise exception 'expected edit_investment signature was not found'; end if;
  v_definition := pg_catalog.replace(v_definition,
    E'  v_account_currency text;\n  v_rate numeric;',
    E'  v_account_currency text;\n  v_funding_currency text;\n  v_rate numeric;\n  v_funding_rate numeric;');
  v_definition := pg_catalog.replace(v_definition,
    E'  v_gross := p_quantity * p_unit_price;',
    E'  select currency_code into strict v_funding_currency from public.financial_accounts\n  where id = v_payment_entry.account_id and user_id = v_user_id;\n  if v_funding_currency = v_original.transaction_currency_code then\n    v_funding_rate := 1::numeric;\n  else\n    select rate into v_funding_rate from public.resolve_historical_exchange_rate(\n      v_original.transaction_currency_code, v_funding_currency, p_occurred_at\n    );\n    if v_funding_rate is null or v_funding_rate <= 0 then\n      raise exception ''a historical funding-account exchange rate is required'' using errcode = ''P0002'';\n    end if;\n  end if;\n\n  v_gross := p_quantity * p_unit_price;');
  v_definition := pg_catalog.replace(v_definition,
    E'v_asset_entry.account_id, ''credit'',\n    v_total, v_total * v_rate, ''investment_payment''',
    E'v_payment_entry.account_id, ''credit'',\n    v_total, v_total * v_funding_rate, v_payment_entry.memo');
  if pg_catalog.strpos(v_definition, 'v_funding_rate') = 0 then raise exception 'edit funding transformation failed'; end if;
  execute v_definition;
end;
$migration$;

revoke all on function public.edit_investment(uuid, numeric, numeric, numeric, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.edit_investment(uuid, numeric, numeric, numeric, timestamptz, text)
  to authenticated;
