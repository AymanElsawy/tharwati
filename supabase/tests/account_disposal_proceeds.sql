begin;

\echo 1..17

create or replace function pg_temp.expect_disposal_failure(
  p_statement text,
  p_expected_message text
)
returns void
language plpgsql
as $$
begin
  execute p_statement;
  raise exception 'disposal statement unexpectedly succeeded';
exception
  when others then
    if position(p_expected_message in sqlerrm) = 0 then
      raise;
    end if;
end;
$$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('1b000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'disposal-a@example.invalid', '', '{}', '{}', now(), now()),
  ('1b000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'disposal-b@example.invalid', '', '{}', '{}', now(), now());

insert into public.financial_accounts (
  id, user_id, account_type_code, name, currency_code, opening_balance,
  is_active, bank_subtype, investment_type
)
values
  ('2b000000-0000-4000-8000-000000000001', '1b000000-0000-4000-8000-000000000001', 'cash', 'Disposal Cash', 'USD', 0, true, null, null),
  ('2b000000-0000-4000-8000-000000000002', '1b000000-0000-4000-8000-000000000001', 'bank', 'Disposal Bank', 'USD', 10, true, 'debit', null),
  ('2b000000-0000-4000-8000-000000000003', '1b000000-0000-4000-8000-000000000001', 'cash', 'Inactive Cash', 'USD', 0, false, null, null),
  ('2b000000-0000-4000-8000-000000000004', '1b000000-0000-4000-8000-000000000001', 'brokerage', 'Wrong Type Brokerage', 'USD', 0, true, null, 'stock_etf'),
  ('2b000000-0000-4000-8000-000000000005', '1b000000-0000-4000-8000-000000000001', 'cash', 'EUR Cash', 'EUR', 0, true, null, null),
  ('2b000000-0000-4000-8000-000000000006', '1b000000-0000-4000-8000-000000000002', 'cash', 'Other User Cash', 'USD', 0, true, null, null);

insert into public.financial_accounts (
  id, user_id, account_type_code, name, currency_code, opening_balance,
  property_type, ownership_percentage, initial_ownership_percentage
)
select id, '1b000000-0000-4000-8000-000000000001', 'real_estate', name,
  'USD', 0, 'apartment', 100, 100
from (values
  ('2b000000-0000-4000-8000-000000000101'::uuid, 'Cash Sale Property'),
  ('2b000000-0000-4000-8000-000000000102'::uuid, 'Bank Sale Property'),
  ('2b000000-0000-4000-8000-000000000103'::uuid, 'Wrong User Property'),
  ('2b000000-0000-4000-8000-000000000104'::uuid, 'Inactive Destination Property'),
  ('2b000000-0000-4000-8000-000000000105'::uuid, 'Wrong Type Property'),
  ('2b000000-0000-4000-8000-000000000106'::uuid, 'Currency Mismatch Property'),
  ('2b000000-0000-4000-8000-000000000107'::uuid, 'Missing Destination Property'),
  ('2b000000-0000-4000-8000-000000000108'::uuid, 'Zero Proceeds Property'),
  ('2b000000-0000-4000-8000-000000000110'::uuid, 'Atomic Rollback Property'),
  ('2b000000-0000-4000-8000-000000000113'::uuid, 'Precision Property'),
  ('2b000000-0000-4000-8000-000000000114'::uuid, 'NaN Property'),
  ('2b000000-0000-4000-8000-000000000115'::uuid, 'Infinity Property')
) as source(id, name);

insert into public.financial_accounts (
  id, user_id, account_type_code, name, currency_code, opening_balance,
  ownership_percentage, initial_ownership_percentage, business_type, industry
)
values (
  '2b000000-0000-4000-8000-000000000112',
  '1b000000-0000-4000-8000-000000000001',
  'business', 'Replay Business', 'USD', 0, 100, 100, 'private_company', 'technology'
);

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '1b000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

select public.add_account_disposal(
  '2b000000-0000-4000-8000-000000000101', current_date, 100.25, 'USD', 100,
  '3b000000-0000-4000-8000-000000000001', 'cash proceeds',
  '2b000000-0000-4000-8000-000000000001'
);

do $test$
declare v_balance numeric;
begin
  select current_balance::numeric into strict v_balance
  from public.get_account_balances(array['2b000000-0000-4000-8000-000000000001'::uuid]);
  if v_balance <> 100.25 or not exists (
    select 1 from public.account_disposals
    where idempotency_key = '3b000000-0000-4000-8000-000000000001'
      and sale_amount = 100.25 and proceeds_transaction_id is not null
  ) or (
    select count(*)
    from public.transaction_entries entries
    join public.account_disposals disposal
      on disposal.proceeds_transaction_id = entries.transaction_id
    where disposal.idempotency_key = '3b000000-0000-4000-8000-000000000001'
      and entries.transaction_amount = 100.25
      and entries.account_amount = 100.25
  ) <> 2 or not exists (
    select 1 from public.financial_accounts
    where id = '2b000000-0000-4000-8000-000000000101'
      and not is_active and ownership_percentage = 0 and closed_reason = 'sold'
  ) then
    raise exception 'Cash proceeds or Real Estate full disposal projection is incorrect';
  end if;
end;
$test$;
\echo ok 1 - valid Cash proceeds, balance projection, and Real Estate full sale

select public.add_account_disposal(
  '2b000000-0000-4000-8000-000000000102', current_date, 25, 'USD', 100,
  '3b000000-0000-4000-8000-000000000002', null,
  '2b000000-0000-4000-8000-000000000002'
);
do $test$ declare v_balance numeric; begin
  select current_balance::numeric into strict v_balance
  from public.get_account_balances(array['2b000000-0000-4000-8000-000000000002'::uuid]);
  if v_balance <> 35 then raise exception 'Bank proceeds balance expected 35, got %', v_balance; end if;
end; $test$;
\echo ok 2 - valid Bank proceeds

select pg_temp.expect_disposal_failure(
  $$select public.add_account_disposal('2b000000-0000-4000-8000-000000000103', current_date, 10, 'USD', 100, '3b000000-0000-4000-8000-000000000003', null, '2b000000-0000-4000-8000-000000000006')$$,
  'An active owned Cash or Bank destination account is required'
);
\echo ok 3 - wrong-user destination rejected

select pg_temp.expect_disposal_failure(
  $$select public.add_account_disposal('2b000000-0000-4000-8000-000000000104', current_date, 10, 'USD', 100, '3b000000-0000-4000-8000-000000000004', null, '2b000000-0000-4000-8000-000000000003')$$,
  'An active owned Cash or Bank destination account is required'
);
\echo ok 4 - inactive destination rejected

select pg_temp.expect_disposal_failure(
  $$select public.add_account_disposal('2b000000-0000-4000-8000-000000000105', current_date, 10, 'USD', 100, '3b000000-0000-4000-8000-000000000005', null, '2b000000-0000-4000-8000-000000000004')$$,
  'An active owned Cash or Bank destination account is required'
);
\echo ok 5 - wrong destination type rejected

select pg_temp.expect_disposal_failure(
  $$select public.add_account_disposal('2b000000-0000-4000-8000-000000000106', current_date, 10, 'USD', 100, '3b000000-0000-4000-8000-000000000006', null, '2b000000-0000-4000-8000-000000000005')$$,
  'Destination account currency must match sale currency'
);
\echo ok 6 - destination currency mismatch rejected

select pg_temp.expect_disposal_failure(
  $$select public.add_account_disposal('2b000000-0000-4000-8000-000000000107', current_date, 10, 'USD', 100, '3b000000-0000-4000-8000-000000000007', null, null)$$,
  'A destination account is required for positive sale proceeds'
);
\echo ok 7 - positive amount requires destination

select public.add_account_disposal(
  '2b000000-0000-4000-8000-000000000108', current_date, 0, 'USD', 100,
  '3b000000-0000-4000-8000-000000000008', null, null
);
do $test$ begin
  if not exists (
    select 1 from public.account_disposals
    where idempotency_key = '3b000000-0000-4000-8000-000000000008'
      and sale_amount = 0 and proceeds_account_id is null and proceeds_transaction_id is null
  ) then raise exception 'zero-proceeds disposal was not stored without allocation'; end if;
end; $test$;
\echo ok 8 - zero proceeds needs no destination

select pg_temp.expect_disposal_failure(
  $$select public.add_account_disposal('2b000000-0000-4000-8000-000000000110', current_date, 77, 'USD', 50, '3b000000-0000-4000-8000-000000000010', 'atomic rollback marker', '2b000000-0000-4000-8000-000000000001')$$,
  'Real Estate supports full sale only'
);
do $test$ declare v_balance numeric; begin
  select current_balance::numeric into strict v_balance
  from public.get_account_balances(array['2b000000-0000-4000-8000-000000000001'::uuid]);
  if v_balance <> 100.25
    or exists (select 1 from public.account_disposals where account_id = '2b000000-0000-4000-8000-000000000110')
    or exists (select 1 from public.financial_transactions where notes = 'atomic rollback marker') then
    raise exception 'failed disposal left proceeds side effects';
  end if;
end; $test$;
\echo ok 9 - projection failure rolls back disposal and proceeds

select pg_temp.expect_disposal_failure(
  $$select public.correct_account_disposal((select id from public.account_disposals where idempotency_key = '3b000000-0000-4000-8000-000000000001'), current_date, 100.25, 'USD', 100, 'blocked correction', '2b000000-0000-4000-8000-000000000001')$$,
  'account_disposal_correction_blocked:allocated_proceeds'
);
\echo ok 10 - allocated disposal correction blocked

select public.add_account_disposal(
  '2b000000-0000-4000-8000-000000000112', current_date, 50, 'USD', 25,
  '3b000000-0000-4000-8000-000000000012', 'partial business',
  '2b000000-0000-4000-8000-000000000001'
);
do $test$ begin
  if not exists (
    select 1 from public.financial_accounts
    where id = '2b000000-0000-4000-8000-000000000112'
      and is_active and ownership_percentage = 75
  ) then raise exception 'Business partial disposal projection is incorrect'; end if;
end; $test$;
\echo ok 11 - Business partial disposal

do $test$
declare
  v_balance numeric;
  v_original_id uuid;
  v_replay public.account_disposals%rowtype;
begin
  select id into strict v_original_id
  from public.account_disposals
  where idempotency_key = '3b000000-0000-4000-8000-000000000012';
  select * into strict v_replay
  from public.add_account_disposal(
    '2b000000-0000-4000-8000-000000000112', current_date, 50.00, 'USD', 25.00,
    '3b000000-0000-4000-8000-000000000012', 'partial business',
    '2b000000-0000-4000-8000-000000000001'
  );
  select current_balance::numeric into strict v_balance
  from public.get_account_balances(array['2b000000-0000-4000-8000-000000000001'::uuid]);
  if v_replay.id <> v_original_id
    or (select count(*) from public.account_disposals where idempotency_key = '3b000000-0000-4000-8000-000000000012') <> 1
    or (select count(*) from public.financial_transactions where external_reference = 'account_disposal:' ||
      (select id::text from public.account_disposals where idempotency_key = '3b000000-0000-4000-8000-000000000012')) <> 1
    or v_balance <> 150.25
    or (select ownership_percentage from public.financial_accounts where id = '2b000000-0000-4000-8000-000000000112') <> 75 then
    raise exception 'identical replay duplicated disposal effects';
  end if;
end; $test$;
\echo ok 12 - identical replay returns original without duplicate effects

select pg_temp.expect_disposal_failure(
  $$select public.add_account_disposal('2b000000-0000-4000-8000-000000000112', current_date, 51, 'USD', 25, '3b000000-0000-4000-8000-000000000012', 'partial business', '2b000000-0000-4000-8000-000000000001')$$,
  'Idempotency key was already used with different disposal data'
);
\echo ok 13 - changed payload cannot reuse idempotency key

select public.add_account_disposal(
  '2b000000-0000-4000-8000-000000000112', current_date, 150, 'USD', 75,
  '3b000000-0000-4000-8000-000000000013', 'full business',
  '2b000000-0000-4000-8000-000000000001'
);
do $test$ begin
  if not exists (
    select 1 from public.financial_accounts
    where id = '2b000000-0000-4000-8000-000000000112'
      and not is_active and ownership_percentage = 0 and closed_reason = 'sold'
  ) then raise exception 'Business full disposal projection is incorrect'; end if;
end; $test$;
\echo ok 14 - Business full disposal

select pg_temp.expect_disposal_failure(
  $$select public.add_account_disposal('2b000000-0000-4000-8000-000000000113', current_date, 1.001, 'USD', 100, '3b000000-0000-4000-8000-000000000014', null, '2b000000-0000-4000-8000-000000000001')$$,
  'Sale amount must be finite, non-negative, and have at most 2 decimal places'
);
\echo ok 15 - sale amount with more than 2 decimals rejected

select pg_temp.expect_disposal_failure(
  $$select public.add_account_disposal('2b000000-0000-4000-8000-000000000114', current_date, 'NaN'::numeric, 'USD', 100, '3b000000-0000-4000-8000-000000000015', null, '2b000000-0000-4000-8000-000000000001')$$,
  'Sale amount must be finite, non-negative, and have at most 2 decimal places'
);
\echo ok 16 - NaN sale amount rejected

select pg_temp.expect_disposal_failure(
  $$select public.add_account_disposal('2b000000-0000-4000-8000-000000000115', current_date, 'Infinity'::numeric, 'USD', 100, '3b000000-0000-4000-8000-000000000016', null, '2b000000-0000-4000-8000-000000000001')$$,
  'Sale amount must be finite, non-negative, and have at most 2 decimal places'
);
\echo ok 17 - infinite sale amount rejected

rollback;
