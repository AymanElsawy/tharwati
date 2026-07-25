begin;

\echo 1..5

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '12000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'account-currency-a@example.invalid',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '12000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'account-currency-b@example.invalid',
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
  opening_balance,
  notes
)
values
  (
    '22000000-0000-4000-8000-000000000001',
    '12000000-0000-4000-8000-000000000001',
    'cash',
    'No History',
    'USD',
    1000,
    null
  ),
  (
    '22000000-0000-4000-8000-000000000002',
    '12000000-0000-4000-8000-000000000001',
    'cash',
    'Posted History',
    'USD',
    1000,
    null
  ),
  (
    '22000000-0000-4000-8000-000000000003',
    '12000000-0000-4000-8000-000000000001',
    'brokerage',
    'Investment History',
    'USD',
    1000,
    null
  );

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '12000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

update public.financial_accounts
set currency_code = 'SAR'
where id = '22000000-0000-4000-8000-000000000001';

do $test$
begin
  if not exists (
    select 1
    from public.financial_accounts
    where id = '22000000-0000-4000-8000-000000000001'
      and currency_code = 'SAR'
  ) then
    raise exception 'currency did not change before history existed';
  end if;
end;
$test$;

\echo ok 1 - currency changes before history exists

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
  '32000000-0000-4000-8000-000000000001',
  '12000000-0000-4000-8000-000000000001',
  'deposit',
  'USD',
  'draft',
  now(),
  'Account currency test'
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
values
  (
    '32000000-0000-4000-8000-000000000001',
    '12000000-0000-4000-8000-000000000001',
    '22000000-0000-4000-8000-000000000002',
    'debit',
    10,
    10,
    'deposit'
  ),
  (
    '32000000-0000-4000-8000-000000000001',
    '12000000-0000-4000-8000-000000000001',
    '22000000-0000-4000-8000-000000000002',
    'credit',
    10,
    10,
    'offset'
  );

select public.post_transaction(
  '32000000-0000-4000-8000-000000000001'
);

do $test$
begin
  begin
    update public.financial_accounts
    set currency_code = 'EUR'
    where id = '22000000-0000-4000-8000-000000000002';
    raise exception 'posted-history currency update unexpectedly succeeded';
  exception
    when check_violation then
      if sqlerrm <>
        'This account already contains financial history. Its currency cannot be changed.'
      then
        raise;
      end if;
  end;
end;
$test$;

\echo ok 2 - currency cannot change after a posted transaction

select public.add_investment(
  p_account_id => '22000000-0000-4000-8000-000000000003',
  p_new_account_type_code => null,
  p_new_account_name => null,
  p_new_account_currency_code => null,
  p_new_account_institution_name => null,
  p_asset_id => null,
  p_new_asset_type_code => 'stock',
  p_new_asset_name => 'Account Currency Test Stock',
  p_new_asset_symbol => 'ACTS',
  p_new_asset_currency_code => 'USD',
  p_new_asset_exchange => 'XTEST',
  p_identifier_scheme => 'ticker',
  p_identifier_namespace => 'XTEST',
  p_identifier_value => 'ACTS',
  p_identifier_provider => null,
  p_quantity => 1,
  p_unit_price => 100,
  p_fees => 1,
  p_occurred_at => now(),
  p_notes => null
);

do $test$
begin
  begin
    update public.financial_accounts
    set currency_code = 'GBP'
    where id = '22000000-0000-4000-8000-000000000003';
    raise exception 'investment-history currency update unexpectedly succeeded';
  exception
    when check_violation then
      if sqlerrm <>
        'This account already contains financial history. Its currency cannot be changed.'
      then
        raise;
      end if;
  end;
end;
$test$;

\echo ok 3 - currency cannot change after investment posting

update public.financial_accounts
set
  name = 'Renamed with History',
  notes = 'Notes remain editable'
where id = '22000000-0000-4000-8000-000000000003';

do $test$
begin
  if not exists (
    select 1
    from public.financial_accounts
    where id = '22000000-0000-4000-8000-000000000003'
      and name = 'Renamed with History'
      and notes = 'Notes remain editable'
  ) then
    raise exception 'name or notes edit failed after history';
  end if;
end;
$test$;

\echo ok 4 - name and notes remain editable

reset role;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '12000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;

update public.financial_accounts
set currency_code = 'EGP'
where id = '22000000-0000-4000-8000-000000000003';

reset role;

do $test$
begin
  if not exists (
    select 1
    from public.financial_accounts
    where id = '22000000-0000-4000-8000-000000000003'
      and currency_code = 'USD'
  ) then
    raise exception 'user B bypassed account ownership or currency rule';
  end if;
end;
$test$;

\echo ok 5 - other users cannot bypass ownership or currency immutability

rollback;
