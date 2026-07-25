begin;

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'account-balance-test@example.invalid',
  '',
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into public.financial_accounts (
  id,
  user_id,
  account_type_code,
  name,
  currency_code,
  opening_balance
)
values (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'brokerage',
  'Projection Test',
  'SAR',
  100000
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

create temporary table account_balance_test_context (
  asset_id uuid not null
) on commit drop;

insert into account_balance_test_context (asset_id)
select (result->'asset'->>'id')::uuid
from (
  select public.add_investment(
  p_account_id => '20000000-0000-4000-8000-000000000001',
  p_new_account_type_code => null,
  p_new_account_name => null,
  p_new_account_currency_code => null,
  p_new_account_institution_name => null,
  p_asset_id => null,
  p_new_asset_type_code => 'stock',
  p_new_asset_name => 'Projection Test Stock',
  p_new_asset_symbol => 'PTS',
  p_new_asset_currency_code => 'SAR',
  p_new_asset_exchange => 'XTEST',
  p_identifier_scheme => 'ticker',
  p_identifier_namespace => 'XTEST',
  p_identifier_value => 'PTS',
  p_identifier_provider => null,
  p_quantity => 10,
  p_unit_price => 2000,
  p_fees => 100,
  p_occurred_at => now(),
  p_notes => null
  ) as result
) as investment;

do $test$
declare
  v_balance numeric;
begin
  select current_balance::numeric
  into v_balance
  from public.get_account_balances(
    array['20000000-0000-4000-8000-000000000001'::uuid]
  );

  if v_balance <> 79900 then
    raise exception
      'expected purchase plus fee balance 79900, got %',
      v_balance;
  end if;
end;
$test$;

select public.add_investment(
  p_account_id => '20000000-0000-4000-8000-000000000001',
  p_new_account_type_code => null,
  p_new_account_name => null,
  p_new_account_currency_code => null,
  p_new_account_institution_name => null,
  p_asset_id => (
    select asset_id
    from account_balance_test_context
  ),
  p_new_asset_type_code => null,
  p_new_asset_name => null,
  p_new_asset_symbol => null,
  p_new_asset_currency_code => null,
  p_new_asset_exchange => null,
  p_identifier_scheme => null,
  p_identifier_namespace => null,
  p_identifier_value => null,
  p_identifier_provider => null,
  p_quantity => 1,
  p_unit_price => 1000,
  p_fees => 10,
  p_occurred_at => now(),
  p_notes => null
);

-- Draft/deleted rows are projection fixtures, not browser write tests.
reset role;

insert into public.financial_transactions (
  id,
  user_id,
  transaction_type_code,
  transaction_currency_code,
  status,
  occurred_at,
  description
)
values (
  '30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'buy',
  'SAR',
  'draft',
  now(),
  'Ignored draft'
);

insert into public.transaction_entries (
  transaction_id,
  user_id,
  account_id,
  entry_side,
  transaction_amount,
  account_amount,
  memo
)
values (
  '30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'credit',
  500,
  500,
  'ignored_draft_effect'
);

set local role authenticated;

do $test$
declare
  v_balance numeric;
begin
  select current_balance::numeric
  into v_balance
  from public.get_account_balances(
    array['20000000-0000-4000-8000-000000000001'::uuid]
  );

  if v_balance <> 78890 then
    raise exception
      'multiple purchases or draft filtering failed: %',
      v_balance;
  end if;
end;
$test$;

reset role;

delete from public.financial_transactions
where id = '30000000-0000-4000-8000-000000000001';

set local role authenticated;

do $test$
declare
  v_balance numeric;
begin
  select current_balance::numeric
  into v_balance
  from public.get_account_balances(
    array['20000000-0000-4000-8000-000000000001'::uuid]
  );

  if v_balance <> 78890 then
    raise exception 'deleted transaction affected balance: %', v_balance;
  end if;
end;
$test$;

reset role;

do $test$
begin
  if (
    select opening_balance
    from public.financial_accounts
    where id = '20000000-0000-4000-8000-000000000001'
  ) <> 100000 then
    raise exception 'opening balance was mutated';
  end if;
end;
$test$;

rollback;
