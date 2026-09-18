-- Add UAE Dirham as a first-class currency without changing existing access rules.

insert into public.currencies (code, name, symbol)
values ('AED', 'United Arab Emirates Dirham', 'د.إ')
on conflict (code) do update
set name = excluded.name,
    symbol = excluded.symbol,
    decimal_places = 2,
    is_active = true;

alter table public.profiles
  drop constraint profiles_base_currency_code_check,
  add constraint profiles_base_currency_code_check
    check (base_currency_code is null or base_currency_code in ('USD', 'SAR', 'EGP', 'EUR', 'GBP', 'AED'));

alter table public.financial_accounts
  drop constraint financial_accounts_currency_code_check,
  add constraint financial_accounts_currency_code_check
    check (currency_code in ('USD', 'SAR', 'EGP', 'EUR', 'GBP', 'AED'));

alter table public.assets
  drop constraint assets_currency_code_check,
  add constraint assets_currency_code_check
    check (currency_code in ('USD', 'SAR', 'EGP', 'EUR', 'GBP', 'AED'));

alter table public.market_prices
  drop constraint market_prices_currency_code_check,
  add constraint market_prices_currency_code_check
    check (currency_code in ('USD', 'SAR', 'EGP', 'EUR', 'GBP', 'AED'));

alter table public.dashboard_valuation_snapshots
  drop constraint dashboard_valuation_snapshots_base_currency_code_check,
  add constraint dashboard_valuation_snapshots_base_currency_code_check
    check (base_currency_code in ('USD', 'SAR', 'EGP', 'EUR', 'GBP', 'AED'));

alter table public.account_disposals
  drop constraint account_disposals_sale_currency_code_check,
  add constraint account_disposals_sale_currency_code_check
    check (sale_currency_code in ('USD', 'SAR', 'EGP', 'EUR', 'GBP', 'AED'));

alter table public.goals
  drop constraint goals_currency_code_check,
  add constraint goals_currency_code_check
    check (currency_code in ('USD', 'SAR', 'EGP', 'EUR', 'GBP', 'AED'));

-- Preserve each current function body, security mode, search path, grants, and
-- financial behavior. Only expand its existing five-currency validation set.
do $$
declare
  v_name text;
  v_oid oid;
  v_definition text;
  v_old constant text := '(''USD'', ''SAR'', ''EGP'', ''EUR'', ''GBP'')';
  v_new constant text := '(''USD'', ''SAR'', ''EGP'', ''EUR'', ''GBP'', ''AED'')';
begin
  foreach v_name in array array[
    'resolve_external_brokerage_asset',
    'create_valued_account',
    'post_account_disposal_proceeds_internal',
    'add_account_disposal',
    'correct_account_disposal'
  ] loop
    select procedures.oid
    into strict v_oid
    from pg_catalog.pg_proc as procedures
    join pg_catalog.pg_namespace as namespaces
      on namespaces.oid = procedures.pronamespace
    where namespaces.nspname = 'public'
      and procedures.proname = v_name;

    v_definition := pg_catalog.pg_get_functiondef(v_oid);
    if pg_catalog.strpos(v_definition, v_old) = 0 then
      raise exception 'Expected currency validation was not found in public.%', v_name;
    end if;

    execute pg_catalog.replace(v_definition, v_old, v_new);
  end loop;
end;
$$;
