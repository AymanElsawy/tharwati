do $$
declare
  v_function_definition text;
begin
  select pg_catalog.pg_get_functiondef(procedure.oid)
  into v_function_definition
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'add_investment'
    and pg_catalog.pg_get_function_identity_arguments(procedure.oid) =
      'p_account_id uuid, p_new_account_type_code text, p_new_account_name text, p_new_account_currency_code text, p_new_account_institution_name text, p_asset_id uuid, p_new_asset_type_code text, p_new_asset_name text, p_new_asset_symbol text, p_new_asset_currency_code text, p_new_asset_exchange text, p_identifier_scheme text, p_identifier_namespace text, p_identifier_value text, p_identifier_provider text, p_quantity numeric, p_unit_price numeric, p_fees numeric, p_occurred_at timestamp with time zone, p_notes text';

  if v_function_definition is null then
    raise exception 'expected add_investment function signature was not found';
  end if;

  if pg_catalog.strpos(v_function_definition, 'p_new_account_institution_name text') = 0
    or pg_catalog.strpos(v_function_definition, 'institution_name,') = 0
    or pg_catalog.strpos(v_function_definition, 'nullif(pg_catalog.btrim(p_new_account_institution_name), ''''),') = 0
  then
    raise exception 'add_investment institution contract did not match the expected definition';
  end if;

  v_function_definition := pg_catalog.regexp_replace(
    v_function_definition,
    'p_new_account_institution_name text,[[:space:]]*',
    ''
  );
  v_function_definition := pg_catalog.regexp_replace(
    v_function_definition,
    E'\\n[[:space:]]*institution_name,',
    ''
  );
  v_function_definition := pg_catalog.regexp_replace(
    v_function_definition,
    E'\\n[[:space:]]*nullif\\(pg_catalog\\.btrim\\(p_new_account_institution_name\\), \'\'\\),',
    ''
  );

  if pg_catalog.strpos(v_function_definition, 'institution_name') > 0 then
    raise exception 'add_investment institution contract was not removed completely';
  end if;

  execute v_function_definition;
end;
$$;

drop function public.add_investment(
  uuid, text, text, text, text, uuid, text, text, text, text, text,
  text, text, text, text, numeric, numeric, numeric,
  timestamptz, text
);

alter table public.financial_accounts
  drop column institution_name;

revoke all on function public.add_investment(
  uuid, text, text, text, uuid, text, text, text, text, text,
  text, text, text, text, numeric, numeric, numeric,
  timestamptz, text
) from public, anon, authenticated;

grant execute on function public.add_investment(
  uuid, text, text, text, uuid, text, text, text, text, text,
  text, text, text, text, numeric, numeric, numeric,
  timestamptz, text
) to authenticated;

comment on function public.add_investment(
  uuid, text, text, text, uuid, text, text, text, text, text,
  text, text, text, text, numeric, numeric, numeric,
  timestamptz, text
) is
  'Creates or reuses an account without institution metadata, creates or reuses an asset, records balanced draft ledger entries, projects the holding, and posts through the trusted transaction path.';
