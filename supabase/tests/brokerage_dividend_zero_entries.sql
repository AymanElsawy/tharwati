begin;

\echo 1..9

create or replace function pg_temp.expect_dividend_failure(
  p_statement text,
  p_expected_message text
)
returns void
language plpgsql
as $$
begin
  execute p_statement;
  raise exception 'dividend statement unexpectedly succeeded';
exception
  when others then
    if position(p_expected_message in sqlerrm) = 0 then raise; end if;
end;
$$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '1d000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'dividend@example.invalid', '',
  '{}', '{}', now(), now()
);

insert into public.financial_accounts (
  id, user_id, account_type_code, name, currency_code, opening_balance,
  is_active, investment_type
)
values (
  '2d000000-0000-4000-8000-000000000001',
  '1d000000-0000-4000-8000-000000000001',
  'brokerage', 'Dividend Brokerage', 'USD', 0, true, 'stock_etf'
);

insert into public.assets (
  id, user_id, asset_type_code, symbol, name, currency_code, exchange,
  is_custom, is_active, canonical_quantity_unit
)
values (
  '3d000000-0000-4000-8000-000000000001',
  '1d000000-0000-4000-8000-000000000001',
  'stock', 'DIVT', 'Dividend Test Asset', 'USD', 'XTEST',
  true, true, 'shares'
);

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '1d000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

select public.add_existing_holding(
  '2d000000-0000-4000-8000-000000000001',
  '3d000000-0000-4000-8000-000000000001',
  10, 10, now(), 'dividend test opening', null
);

select public.add_brokerage_cash_dividend(
  '2d000000-0000-4000-8000-000000000001',
  '3d000000-0000-4000-8000-000000000001',
  10, 0, 0, now(), 'zero cash'
);
select public.add_brokerage_dividend_reinvestment(
  '2d000000-0000-4000-8000-000000000001',
  '3d000000-0000-4000-8000-000000000001',
  10, 0, 0, 2, now(), 'zero full'
);
select public.add_brokerage_partial_dividend_reinvestment(
  '2d000000-0000-4000-8000-000000000001',
  '3d000000-0000-4000-8000-000000000001',
  10, 0, 0, 4, 2, now(), 'zero partial'
);

do $test$
begin
  if exists (
    select 1 from public.transaction_entries e
    join public.financial_transactions t on t.id = e.transaction_id
    where t.notes in ('zero cash', 'zero full', 'zero partial')
      and e.memo in ('brokerage_dividend_tax', 'brokerage_dividend_fee')
  ) or (select count(*) from public.transaction_entries e join public.financial_transactions t on t.id=e.transaction_id where t.notes='zero cash') <> 2
    or (select count(*) from public.transaction_entries e join public.financial_transactions t on t.id=e.transaction_id where t.notes='zero full') <> 2
    or (select count(*) from public.transaction_entries e join public.financial_transactions t on t.id=e.transaction_id where t.notes='zero partial') <> 3 then
    raise exception 'zero tax/fee dividend shapes are incorrect';
  end if;
end;
$test$;
\echo ok 1 - zero tax and fees omit optional legs in all three modes

select public.add_brokerage_cash_dividend(
  '2d000000-0000-4000-8000-000000000001',
  '3d000000-0000-4000-8000-000000000001',
  10, 2, 0, now(), 'tax only'
);
do $test$ begin
  if (select count(*) from public.transaction_entries e join public.financial_transactions t on t.id=e.transaction_id where t.notes='tax only' and e.memo='brokerage_dividend_tax') <> 1
    or exists (select 1 from public.transaction_entries e join public.financial_transactions t on t.id=e.transaction_id where t.notes='tax only' and e.memo='brokerage_dividend_fee') then
    raise exception 'tax-only dividend shape is incorrect';
  end if;
end; $test$;
\echo ok 2 - tax-only dividend persists only the tax optional leg

select public.add_brokerage_dividend_reinvestment(
  '2d000000-0000-4000-8000-000000000001',
  '3d000000-0000-4000-8000-000000000001',
  10, 0, 2, 2, now(), 'fee only'
);
do $test$ begin
  if (select count(*) from public.transaction_entries e join public.financial_transactions t on t.id=e.transaction_id where t.notes='fee only' and e.memo='brokerage_dividend_fee') <> 1
    or exists (select 1 from public.transaction_entries e join public.financial_transactions t on t.id=e.transaction_id where t.notes='fee only' and e.memo='brokerage_dividend_tax') then
    raise exception 'fee-only dividend shape is incorrect';
  end if;
end; $test$;
\echo ok 3 - fee-only dividend persists only the fee optional leg

select public.add_brokerage_partial_dividend_reinvestment(
  '2d000000-0000-4000-8000-000000000001',
  '3d000000-0000-4000-8000-000000000001',
  10, 1, 1, 4, 2, now(), 'tax and fee'
);
do $test$ begin
  if (select count(*) from public.transaction_entries e join public.financial_transactions t on t.id=e.transaction_id where t.notes='tax and fee' and e.memo='brokerage_dividend_tax') <> 1
    or (select count(*) from public.transaction_entries e join public.financial_transactions t on t.id=e.transaction_id where t.notes='tax and fee' and e.memo='brokerage_dividend_fee') <> 1 then
    raise exception 'tax-and-fee dividend shape is incorrect';
  end if;
end; $test$;
\echo ok 4 - both non-zero optional legs are persisted

select public.add_brokerage_cash_dividend(
  '2d000000-0000-4000-8000-000000000001',
  '3d000000-0000-4000-8000-000000000001',
  10, 0.00000000004, 0.00000000004, now(), 'rounded zero'
);
do $test$ begin
  if exists (
    select 1 from public.transaction_entries e
    join public.financial_transactions t on t.id=e.transaction_id
    where t.notes='rounded zero' and e.memo in ('brokerage_dividend_tax','brokerage_dividend_fee')
  ) then raise exception 'ledger-rounded zero optional legs were persisted'; end if;
end; $test$;
\echo ok 5 - optional values rounded to zero at ledger precision are omitted

select pg_temp.expect_dividend_failure(
  $$select public.add_brokerage_cash_dividend('2d000000-0000-4000-8000-000000000001','3d000000-0000-4000-8000-000000000001',10,10,0,now(),'zero net')$$,
  'Net dividend must be positive'
);
select pg_temp.expect_dividend_failure(
  $$select public.add_brokerage_dividend_reinvestment('2d000000-0000-4000-8000-000000000001','3d000000-0000-4000-8000-000000000001',10,11,0,2,now(),'negative net')$$,
  'Net dividend must be positive'
);
do $test$ begin
  if exists (select 1 from public.financial_transactions where notes in ('zero net','negative net')) then
    raise exception 'rejected net dividend left transaction residue';
  end if;
end; $test$;
\echo ok 6 - zero and negative net dividends are rejected without residue

do $test$
declare v_cash numeric; v_quantity numeric; v_basis numeric;
begin
  select current_balance::numeric into strict v_cash
  from public.get_account_balances(array['2d000000-0000-4000-8000-000000000001'::uuid]);
  select quantity,total_cost_basis into v_quantity,v_basis from public.holdings
    where account_id='2d000000-0000-4000-8000-000000000001' and asset_id='3d000000-0000-4000-8000-000000000001';
  if v_cash <> 38 or v_quantity <> 23 or v_basis <> 126 then
    raise exception 'dividend projections incorrect: cash %, quantity %, basis %',v_cash,v_quantity,v_basis;
  end if;
end;
$test$;
\echo ok 7 - cash, quantity, and cost-basis effects are correct across modes

do $test$ begin
  if exists (
    select 1 from public.transaction_entries e
    join public.financial_transactions t on t.id=e.transaction_id
    where t.transaction_type_code='dividend'
      and (e.transaction_amount <= 0 or e.account_amount <= 0)
  ) then raise exception 'persisted dividend entry has a non-positive amount'; end if;
end; $test$;
\echo ok 8 - every persisted dividend entry has positive transaction and account amounts

reset role;
create or replace function pg_temp.reject_dividend_cash_entry()
returns trigger language plpgsql as $$
begin
  if new.memo = 'brokerage_dividend_cash' then raise exception 'forced dividend entry failure'; end if;
  return new;
end;
$$;
create trigger test_reject_dividend_cash_entry
before insert on public.transaction_entries
for each row execute function pg_temp.reject_dividend_cash_entry();
set local role authenticated;
select pg_temp.expect_dividend_failure(
  $$select public.add_brokerage_cash_dividend('2d000000-0000-4000-8000-000000000001','3d000000-0000-4000-8000-000000000001',10,0,0,now(),'forced rollback')$$,
  'forced dividend entry failure'
);
do $test$ declare v_cash numeric; begin
  select current_balance::numeric into strict v_cash
  from public.get_account_balances(array['2d000000-0000-4000-8000-000000000001'::uuid]);
  if exists (select 1 from public.financial_transactions where notes='forced rollback')
    or exists (select 1 from public.transaction_entries e join public.financial_transactions t on t.id=e.transaction_id where t.notes='forced rollback')
    or v_cash <> 38 then
    raise exception 'failed dividend RPC left ledger or projection residue';
  end if;
end; $test$;
\echo ok 9 - a post-header entry failure rolls back transaction, entries, and cash effects

rollback;
