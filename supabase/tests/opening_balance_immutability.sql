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
    '13000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'opening-balance-a@example.invalid',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '13000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'opening-balance-b@example.invalid',
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
    '23000000-0000-4000-8000-000000000001',
    '13000000-0000-4000-8000-000000000001',
    'cash',
    'No History',
    'USD',
    1000,
    null
  ),
  (
    '23000000-0000-4000-8000-000000000002',
    '13000000-0000-4000-8000-000000000001',
    'cash',
    'Posted History',
    'USD',
    1000,
    null
  ),
  (
    '23000000-0000-4000-8000-000000000003',
    '13000000-0000-4000-8000-000000000001',
    'brokerage',
    'Investment History',
    'USD',
    1000,
    null
  );

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '13000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

update public.financial_accounts
set opening_balance = 1500
where id = '23000000-0000-4000-8000-000000000001';

do $test$
begin
  if not exists (
    select 1
    from public.financial_accounts
    where id = '23000000-0000-4000-8000-000000000001'
      and opening_balance = 1500
  ) then
    raise exception 'opening balance did not change before history existed';
  end if;
end;
$test$;

\echo ok 1 - opening balance changes before history exists

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
  '33000000-0000-4000-8000-000000000001',
  '13000000-0000-4000-8000-000000000001',
  'deposit',
  'USD',
  'draft',
  now(),
  'Opening balance test'
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
    '33000000-0000-4000-8000-000000000001',
    '13000000-0000-4000-8000-000000000001',
    '23000000-0000-4000-8000-000000000002',
    'debit',
    10,
    10,
    'deposit'
  ),
  (
    '33000000-0000-4000-8000-000000000001',
    '13000000-0000-4000-8000-000000000001',
    '23000000-0000-4000-8000-000000000002',
    'credit',
    10,
    10,
    'offset'
  );

select public.post_transaction(
  '33000000-0000-4000-8000-000000000001'
);

do $test$
begin
  begin
    update public.financial_accounts
    set opening_balance = 2000
    where id = '23000000-0000-4000-8000-000000000002';
    raise exception 'posted-history opening-balance update unexpectedly succeeded';
  exception
    when check_violation then
      if sqlerrm <>
        'This account already contains financial history. Its opening balance cannot be changed.'
      then
        raise;
      end if;
  end;
end;
$test$;

\echo ok 2 - opening balance cannot change after a posted transaction

select public.add_investment(
  p_account_id => '23000000-0000-4000-8000-000000000003',
  p_new_account_type_code => null,
  p_new_account_name => null,
  p_new_account_currency_code => null,
  p_new_account_institution_name => null,
  p_asset_id => null,
  p_new_asset_type_code => 'stock',
  p_new_asset_name => 'Opening Balance Test Stock',
  p_new_asset_symbol => 'OBTS',
  p_new_asset_currency_code => 'USD',
  p_new_asset_exchange => 'XTEST',
  p_identifier_scheme => 'ticker',
  p_identifier_namespace => 'XTEST',
  p_identifier_value => 'OBTS',
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
    set opening_balance = 3000
    where id = '23000000-0000-4000-8000-000000000003';
    raise exception 'investment-history opening-balance update unexpectedly succeeded';
  exception
    when check_violation then
      if sqlerrm <>
        'This account already contains financial history. Its opening balance cannot be changed.'
      then
        raise;
      end if;
  end;
end;
$test$;

\echo ok 3 - opening balance cannot change after investment posting

update public.financial_accounts
set
  name = 'Renamed with History',
  notes = 'Notes remain editable'
where id = '23000000-0000-4000-8000-000000000003';

do $test$
begin
  if not exists (
    select 1
    from public.financial_accounts
    where id = '23000000-0000-4000-8000-000000000003'
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
  '13000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;

update public.financial_accounts
set opening_balance = 9999
where id = '23000000-0000-4000-8000-000000000003';

reset role;

do $test$
begin
  if not exists (
    select 1
    from public.financial_accounts
    where id = '23000000-0000-4000-8000-000000000003'
      and opening_balance = 1000
  ) then
    raise exception 'user B bypassed account ownership or balance rule';
  end if;
end;
$test$;

\echo ok 5 - other users cannot bypass ownership or opening-balance immutability

rollback;
