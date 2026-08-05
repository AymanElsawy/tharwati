begin;

\echo 1..2

set local role supabase_auth_admin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '18000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'investment-rpc@example.invalid', '',
  now(), '{}'::jsonb, '{}'::jsonb, now(), now()
);

reset role;

insert into public.financial_accounts (
  id, user_id, account_type_code, name, currency_code, opening_balance
)
values (
  '28000000-0000-4000-8000-000000000001',
  '18000000-0000-4000-8000-000000000001',
  'brokerage', 'Existing Brokerage', 'USD', 10000
);

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '18000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

select public.add_investment(
  p_account_id => '28000000-0000-4000-8000-000000000001',
  p_new_account_type_code => null,
  p_new_account_name => null,
  p_new_account_currency_code => null,
  p_asset_id => null,
  p_new_asset_type_code => 'etf',
  p_new_asset_name => 'RPC Existing Account ETF',
  p_new_asset_symbol => 'RPCE',
  p_new_asset_currency_code => 'USD',
  p_new_asset_exchange => 'XTEST',
  p_identifier_scheme => 'ticker',
  p_identifier_namespace => 'XTEST',
  p_identifier_value => 'RPCE',
  p_identifier_provider => null,
  p_quantity => 2.5,
  p_unit_price => 100.125,
  p_fees => 1.25,
  p_occurred_at => now(),
  p_notes => 'existing account smoke'
);

reset role;

do $test$
declare
  v_transactions bigint;
  v_holdings bigint;
begin
  select pg_catalog.count(*) into v_transactions
  from public.financial_transactions as transactions
  where transactions.user_id = '18000000-0000-4000-8000-000000000001'
    and transactions.status = 'posted'
    and exists (
      select 1
      from public.transaction_entries as entries
      where entries.transaction_id = transactions.id
        and entries.account_id = '28000000-0000-4000-8000-000000000001'
    );

  select pg_catalog.count(*) into v_holdings
  from public.holdings
  where user_id = '18000000-0000-4000-8000-000000000001'
    and account_id = '28000000-0000-4000-8000-000000000001';

  if v_transactions <> 1 or v_holdings <> 1 then
    raise exception 'existing-account RPC did not atomically create posted ledger and holding';
  end if;
end;
$test$;
\echo ok 1 - authenticated RPC posts ledger and holding for an existing account

set local role authenticated;

select public.add_investment(
  p_account_id => null,
  p_new_account_type_code => 'brokerage',
  p_new_account_name => 'New Brokerage Without Institution',
  p_new_account_currency_code => 'USD',
  p_asset_id => null,
  p_new_asset_type_code => 'etf',
  p_new_asset_name => 'RPC New Account ETF',
  p_new_asset_symbol => 'RPCN',
  p_new_asset_currency_code => 'USD',
  p_new_asset_exchange => 'XTEST',
  p_identifier_scheme => 'ticker',
  p_identifier_namespace => 'XTEST',
  p_identifier_value => 'RPCN',
  p_identifier_provider => null,
  p_quantity => 3,
  p_unit_price => 50,
  p_fees => 2,
  p_occurred_at => now(),
  p_notes => 'new account smoke'
);

reset role;

do $test$
declare
  v_account_id uuid;
  v_transactions bigint;
  v_holdings bigint;
begin
  select id into strict v_account_id
  from public.financial_accounts
  where user_id = '18000000-0000-4000-8000-000000000001'
    and name = 'New Brokerage Without Institution';

  select pg_catalog.count(*) into v_transactions
  from public.financial_transactions as transactions
  where transactions.status = 'posted'
    and exists (
      select 1
      from public.transaction_entries as entries
      where entries.transaction_id = transactions.id
        and entries.account_id = v_account_id
    );

  select pg_catalog.count(*) into v_holdings
  from public.holdings
  where account_id = v_account_id;

  if v_transactions <> 1 or v_holdings <> 1 then
    raise exception 'new-account RPC did not atomically create account, posted ledger, and holding';
  end if;
end;
$test$;
\echo ok 2 - authenticated RPC creates an account without Institution and posts atomically

rollback;
