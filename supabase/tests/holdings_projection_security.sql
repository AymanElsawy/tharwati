begin;

\echo 1..10

create or replace function pg_temp.assert_forbidden(
  p_statement text,
  p_context text
)
returns void
language plpgsql
as $$
begin
  execute p_statement;
  raise exception 'expected forbidden operation: %', p_context;
exception
  when insufficient_privilege then
    null;
end;
$$;

set local role supabase_auth_admin;

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
values
  (
    '11000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'holdings-security-a@example.invalid',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '11000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'holdings-security-b@example.invalid',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

reset role;

insert into public.financial_accounts (
  id,
  user_id,
  account_type_code,
  name,
  currency_code,
  opening_balance
)
values
  (
    '21000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000001',
    'brokerage',
    'Holdings Security A',
    'USD',
    10000
  ),
  (
    '21000000-0000-4000-8000-000000000002',
    '11000000-0000-4000-8000-000000000002',
    'brokerage',
    'Holdings Security B',
    'USD',
    10000
  );

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '11000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

select public.add_investment(
  p_account_id => '21000000-0000-4000-8000-000000000001',
  p_new_account_type_code => null,
  p_new_account_name => null,
  p_new_account_currency_code => null,
  p_new_account_institution_name => null,
  p_asset_id => null,
  p_new_asset_type_code => 'stock',
  p_new_asset_name => 'Holdings Security Stock A',
  p_new_asset_symbol => 'HSA',
  p_new_asset_currency_code => 'USD',
  p_new_asset_exchange => 'XTEST',
  p_identifier_scheme => 'ticker',
  p_identifier_namespace => 'XTEST',
  p_identifier_value => 'HSA',
  p_identifier_provider => null,
  p_quantity => 2,
  p_unit_price => 100,
  p_fees => 5,
  p_occurred_at => now(),
  p_notes => null
);

do $test$
declare
  v_count bigint;
begin
  select count(*) into v_count
  from public.holdings
  where user_id = '11000000-0000-4000-8000-000000000001';

  if v_count <> 1 then
    raise exception 'user A expected one own holding, got %', v_count;
  end if;

  select count(*) into v_count
  from public.holdings
  where user_id = '11000000-0000-4000-8000-000000000002';

  if v_count <> 0 then
    raise exception 'user A can read user B holdings';
  end if;
end;
$test$;

\echo ok 1 - user A selects only its own holding
\echo ok 2 - user A cannot select user B holdings

select pg_temp.assert_forbidden(
  $sql$
    insert into public.holdings (
      user_id, account_id, asset_id, quantity, average_cost,
      total_cost_basis, cost_currency_code
    )
    select
      '11000000-0000-4000-8000-000000000001',
      '21000000-0000-4000-8000-000000000001',
      assets.id,
      99,
      1,
      99,
      'USD'
    from public.assets as assets
    where assets.user_id = '11000000-0000-4000-8000-000000000001'
    limit 1
  $sql$,
  'authenticated insert'
);
\echo ok 3 - authenticated users cannot insert holdings

select pg_temp.assert_forbidden(
  $$update public.holdings set quantity = 99$$,
  'authenticated quantity update'
);
select pg_temp.assert_forbidden(
  $$update public.holdings set average_cost = 99$$,
  'authenticated average-cost update'
);
select pg_temp.assert_forbidden(
  $$update public.holdings set total_cost_basis = 99$$,
  'authenticated total-cost update'
);
\echo ok 4 - authenticated users cannot update derived financial values

select pg_temp.assert_forbidden(
  $$update public.holdings
    set user_id = '11000000-0000-4000-8000-000000000002',
        account_id = '21000000-0000-4000-8000-000000000002'$$,
  'authenticated ownership update'
);
\echo ok 5 - authenticated users cannot change holding ownership

select pg_temp.assert_forbidden(
  $$delete from public.holdings$$,
  'authenticated delete'
);
\echo ok 6 - authenticated users cannot delete holdings

reset role;

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '11000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;

select public.add_investment(
  p_account_id => '21000000-0000-4000-8000-000000000002',
  p_new_account_type_code => null,
  p_new_account_name => null,
  p_new_account_currency_code => null,
  p_new_account_institution_name => null,
  p_asset_id => null,
  p_new_asset_type_code => 'stock',
  p_new_asset_name => 'Holdings Security Stock B',
  p_new_asset_symbol => 'HSB',
  p_new_asset_currency_code => 'USD',
  p_new_asset_exchange => 'XTEST',
  p_identifier_scheme => 'ticker',
  p_identifier_namespace => 'XTEST',
  p_identifier_value => 'HSB',
  p_identifier_provider => null,
  p_quantity => 3,
  p_unit_price => 50,
  p_fees => 2,
  p_occurred_at => now(),
  p_notes => null
);

do $test$
declare
  v_count bigint;
begin
  select count(*) into v_count
  from public.holdings;

  if v_count <> 1 then
    raise exception 'user B expected only its own holding, got % rows', v_count;
  end if;
end;
$test$;

select pg_temp.assert_forbidden(
  $$update public.holdings set quantity = 999
    where user_id = '11000000-0000-4000-8000-000000000001'$$,
  'user B update user A'
);
select pg_temp.assert_forbidden(
  $$delete from public.holdings
    where user_id = '11000000-0000-4000-8000-000000000001'$$,
  'user B delete user A'
);
\echo ok 7 - user B cannot mutate user A holdings

reset role;

select pg_catalog.set_config('request.jwt.claim.sub', '', true);
set local role anon;

select pg_temp.assert_forbidden(
  $$select * from public.holdings$$,
  'anonymous select'
);
select pg_temp.assert_forbidden(
  $$insert into public.holdings (
      user_id, account_id, asset_id, quantity, average_cost,
      total_cost_basis, cost_currency_code
    )
    values (
      '11000000-0000-4000-8000-000000000001',
      '21000000-0000-4000-8000-000000000001',
      '00000000-0000-0000-0000-000000000001',
      1, 1, 1, 'USD'
    )$$,
  'anonymous insert'
);
select pg_temp.assert_forbidden(
  $$update public.holdings set quantity = 1$$,
  'anonymous update'
);
select pg_temp.assert_forbidden(
  $$delete from public.holdings$$,
  'anonymous delete'
);
\echo ok 8 - anonymous users cannot read or mutate holdings

reset role;

do $test$
declare
  v_user_a_holding public.holdings%rowtype;
  v_before_count bigint;
  v_after_count bigint;
begin
  select *
  into strict v_user_a_holding
  from public.holdings
  where user_id = '11000000-0000-4000-8000-000000000001';

  if v_user_a_holding.quantity <> 2
    or v_user_a_holding.total_cost_basis <> 205
    or v_user_a_holding.average_cost <> 102.5
  then
    raise exception
      'trusted posting projection is incorrect: quantity %, cost %, average %',
      v_user_a_holding.quantity,
      v_user_a_holding.total_cost_basis,
      v_user_a_holding.average_cost;
  end if;
end;
$test$;

\echo ok 9 - trusted add-investment posting rebuilds the holding

do $test$
declare
  v_user_a_holding public.holdings%rowtype;
  v_before_count bigint;
  v_after_count bigint;
begin
  select *
  into strict v_user_a_holding
  from public.holdings
  where user_id = '11000000-0000-4000-8000-000000000001';

  select count(*) into v_before_count
  from public.holdings
  where user_id = '11000000-0000-4000-8000-000000000001';

  perform public.rebuild_holding_projection(
    '11000000-0000-4000-8000-000000000001',
    v_user_a_holding.account_id,
    v_user_a_holding.asset_id,
    null
  );

  select count(*) into v_after_count
  from public.holdings
  where user_id = '11000000-0000-4000-8000-000000000001';

  if v_after_count <> v_before_count then
    raise exception
      'deterministic rebuild changed holding count from % to %',
      v_before_count,
      v_after_count;
  end if;

  if not exists (
    select 1
    from public.holdings
    where id = v_user_a_holding.id
      and quantity = v_user_a_holding.quantity
      and total_cost_basis = v_user_a_holding.total_cost_basis
      and average_cost = v_user_a_holding.average_cost
  ) then
    raise exception 'deterministic rebuild changed the projection';
  end if;
end;
$test$;

\echo ok 10 - rebuilding the same projection is deterministic

rollback;
