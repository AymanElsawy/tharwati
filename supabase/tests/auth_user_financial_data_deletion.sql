begin;

\echo 1..5

create or replace function pg_temp.expect_immutable_delete(
  p_statement text,
  p_expected_message text
)
returns void
language plpgsql
as $$
begin
  execute p_statement;
  raise exception 'posted ledger delete unexpectedly succeeded';
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
  ('71000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cascade@example.invalid', '', '{}', '{}', now(), now()),
  ('71000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'immutability@example.invalid', '', '{}', '{}', now(), now());

insert into public.account_types (code, name)
values
  ('cash', 'Cash'),
  ('brokerage', 'Brokerage'),
  ('gold', 'Gold/Silver'),
  ('real_estate', 'Real Estate'),
  ('business', 'Business')
on conflict (code) do nothing;

insert into public.transaction_types (code, name)
values
  ('income', 'Income'),
  ('buy', 'Buy'),
  ('account_disposal_proceeds', 'Account disposal proceeds')
on conflict (code) do nothing;

insert into public.asset_types (code, name)
values ('stock', 'Stock')
on conflict (code) do nothing;

insert into public.record_categories (
  id, system_code, level, name, sort_order
)
values (
  '70000000-0000-4000-8000-000000000001',
  'food_drinks', 'main', 'Food & Drinks', 1
)
on conflict (system_code) do nothing;

insert into public.financial_accounts (
  id, user_id, account_type_code, name, currency_code, opening_balance,
  bank_subtype, investment_type, balance_grams, purity, purchase_date,
  cost_per_unit, property_type, ownership_percentage,
  initial_ownership_percentage, business_type, industry
)
values
  ('73000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001',
   'cash', 'Cascade Cash', 'USD', 100, null, null, null, null, null, null, null, null, null, null, null),
  ('73000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000001',
   'brokerage', 'Cascade Brokerage', 'USD', 0, null, 'stock_etf', null, null, null, null, null, null, null, null, null),
  ('73000000-0000-4000-8000-000000000003', '71000000-0000-4000-8000-000000000001',
   'gold', 'Cascade Gold', 'USD', 0, null, null, 1, '24k', current_date, 10, null, null, null, null, null),
  ('73000000-0000-4000-8000-000000000004', '71000000-0000-4000-8000-000000000001',
   'real_estate', 'Cascade Property', 'USD', 0, null, null, null, null, null, null, 'apartment', 100, 100, null, null),
  ('73000000-0000-4000-8000-000000000005', '71000000-0000-4000-8000-000000000001',
   'business', 'Cascade Business', 'USD', 0, null, null, null, null, null, null, null, 100, 100, 'private_company', 'technology'),
  ('73000000-0000-4000-8000-000000000101', '71000000-0000-4000-8000-000000000002',
   'cash', 'Protected Cash', 'USD', 0, null, null, null, null, null, null, null, null, null, null, null);

insert into public.record_categories (
  id, user_id, parent_id, level, name, sort_order
)
values (
  '74000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000001', null, 'main', 'Cascade Main', 1
);
insert into public.record_categories (
  id, user_id, parent_id, level, name, sort_order
)
values (
  '74000000-0000-4000-8000-000000000002',
  '71000000-0000-4000-8000-000000000001',
  '74000000-0000-4000-8000-000000000001', 'subcategory', 'Cascade Sub', 1
);
insert into public.record_category_overrides (user_id, category_id, name)
select '71000000-0000-4000-8000-000000000001', id, 'Cascade Override'
from public.record_categories where system_code = 'food_drinks';

insert into public.assets (
  id, user_id, asset_type_code, symbol, name, currency_code, exchange,
  is_custom, canonical_quantity_unit
)
values (
  '75000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000001', 'stock', 'CASCADE',
  'Cascade Security', 'USD', 'XNAS', true, 'shares'
);
insert into public.asset_identifiers (
  id, asset_id, scheme, namespace, value, normalized_value, provider, is_primary
)
values (
  '75000000-0000-4000-8000-000000000002',
  '75000000-0000-4000-8000-000000000001', 'ticker', 'XNAS',
  'CASCADE', 'CASCADE', 'test', true
);
insert into public.holdings (
  id, user_id, account_id, asset_id, quantity, average_cost,
  total_cost_basis, cost_currency_code
)
values (
  '75000000-0000-4000-8000-000000000003',
  '71000000-0000-4000-8000-000000000001',
  '73000000-0000-4000-8000-000000000002',
  '75000000-0000-4000-8000-000000000001', 2, 10, 20, 'USD'
);
insert into public.market_prices (
  id, user_id, asset_id, provider, price, currency_code,
  as_of, fetched_at, price_type
)
values (
  '75000000-0000-4000-8000-000000000004',
  '71000000-0000-4000-8000-000000000001',
  '75000000-0000-4000-8000-000000000001', 'manual', 12, 'USD',
  now(), now(), 'manual'
);

insert into public.financial_transactions (
  id, user_id, transaction_type_code, transaction_currency_code, status,
  occurred_at, description, main_category_id, subcategory_id,
  reverses_transaction_id, corrects_transaction_id
)
values
  ('76000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001',
   'account_disposal_proceeds', 'USD', 'draft', now(), 'Cascade proceeds',
   '74000000-0000-4000-8000-000000000001', '74000000-0000-4000-8000-000000000002',
   null, null),
  ('76000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000001',
   'account_disposal_proceeds', 'USD', 'draft', now(), 'Cascade correction link', null, null,
   '76000000-0000-4000-8000-000000000001', '76000000-0000-4000-8000-000000000001'),
  ('76000000-0000-4000-8000-000000000003', '71000000-0000-4000-8000-000000000001',
   'buy', 'USD', 'draft', now(), 'Cascade asset purchase', null, null, null, null),
  ('76000000-0000-4000-8000-000000000101', '71000000-0000-4000-8000-000000000002',
   'income', 'USD', 'draft', now(), 'Protected posted record', null, null, null, null);

insert into public.transaction_entries (
  id, transaction_id, user_id, account_id, entry_side,
  transaction_amount, account_amount, memo
)
values
  ('77000000-0000-4000-8000-000000000001', '76000000-0000-4000-8000-000000000001',
   '71000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000001',
   'debit', 25, 25, 'account_disposal_proceeds_received'),
  ('77000000-0000-4000-8000-000000000002', '76000000-0000-4000-8000-000000000001',
   '71000000-0000-4000-8000-000000000001', null,
   'credit', 25, 25, 'account_disposal_proceeds'),
  ('77000000-0000-4000-8000-000000000003', '76000000-0000-4000-8000-000000000002',
   '71000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000001',
   'debit', 5, 5, 'account_disposal_proceeds_received'),
  ('77000000-0000-4000-8000-000000000004', '76000000-0000-4000-8000-000000000002',
   '71000000-0000-4000-8000-000000000001', null,
   'credit', 5, 5, 'account_disposal_proceeds'),
  ('77000000-0000-4000-8000-000000000005', '76000000-0000-4000-8000-000000000003',
   '71000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000002',
   'debit', 20, 20, 'buy'),
  ('77000000-0000-4000-8000-000000000006', '76000000-0000-4000-8000-000000000003',
   '71000000-0000-4000-8000-000000000001', null,
   'credit', 20, 20, 'owner_contribution'),
  ('77000000-0000-4000-8000-000000000101', '76000000-0000-4000-8000-000000000101',
   '71000000-0000-4000-8000-000000000002', '73000000-0000-4000-8000-000000000101',
   'debit', 10, 10, null),
  ('77000000-0000-4000-8000-000000000102', '76000000-0000-4000-8000-000000000101',
   '71000000-0000-4000-8000-000000000002', null,
   'credit', 10, 10, 'owner_contribution');

update public.transaction_entries
set asset_id = '75000000-0000-4000-8000-000000000001',
    quantity_delta = 2,
    cost_basis_delta = 20,
    unit_price = 10
where id = '77000000-0000-4000-8000-000000000005';

update public.financial_transactions
set status = 'posted'
where id in (
  '76000000-0000-4000-8000-000000000001',
  '76000000-0000-4000-8000-000000000002',
  '76000000-0000-4000-8000-000000000003',
  '76000000-0000-4000-8000-000000000101'
);

insert into public.account_valuations (
  id, user_id, account_id, valuation_amount, valued_on
)
values (
  '78000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000001',
  '73000000-0000-4000-8000-000000000004', 100, current_date - 1
);
insert into public.account_valuations (
  id, user_id, account_id, valuation_amount, valued_on, corrects_valuation_id
)
values (
  '78000000-0000-4000-8000-000000000002',
  '71000000-0000-4000-8000-000000000001',
  '73000000-0000-4000-8000-000000000004', 110, current_date,
  '78000000-0000-4000-8000-000000000001'
);
insert into public.account_disposals (
  id, user_id, account_id, disposed_on, sale_amount, sale_currency_code,
  ownership_percentage_sold, idempotency_key, proceeds_account_id,
  proceeds_transaction_id
)
values (
  '78000000-0000-4000-8000-000000000003',
  '71000000-0000-4000-8000-000000000001',
  '73000000-0000-4000-8000-000000000004', current_date, 25, 'USD', 100,
  '78000000-0000-4000-8000-000000000004',
  '73000000-0000-4000-8000-000000000001',
  '76000000-0000-4000-8000-000000000001'
);
insert into public.account_disposals (
  id, user_id, account_id, disposed_on, sale_amount, sale_currency_code,
  ownership_percentage_sold, idempotency_key
)
values
  ('78000000-0000-4000-8000-000000000005',
   '71000000-0000-4000-8000-000000000001',
   '73000000-0000-4000-8000-000000000005', current_date - 1, 0, 'USD', 25,
   '78000000-0000-4000-8000-000000000006'),
  ('78000000-0000-4000-8000-000000000007',
   '71000000-0000-4000-8000-000000000001',
   '73000000-0000-4000-8000-000000000005', current_date, 0, 'USD', 25,
   '78000000-0000-4000-8000-000000000008');
update public.account_disposals
set corrects_disposal_id = '78000000-0000-4000-8000-000000000005'
where id = '78000000-0000-4000-8000-000000000007';

insert into public.metal_purchases (
  id, user_id, account_id, purity, purchased_at, quantity_grams,
  cost_per_unit, fees, funding_mode, funding_account_id, funding_transaction_id
)
values
  ('79000000-0000-4000-8000-000000000001',
   '71000000-0000-4000-8000-000000000001',
   '73000000-0000-4000-8000-000000000003', '24k', now(), 1, 10, 0,
   'cash_account', '73000000-0000-4000-8000-000000000001',
   '76000000-0000-4000-8000-000000000001'),
  ('79000000-0000-4000-8000-000000000003',
   '71000000-0000-4000-8000-000000000001',
   '73000000-0000-4000-8000-000000000003', '24k', now(), 1, 11, 0,
   'cash_account', '73000000-0000-4000-8000-000000000001',
   '76000000-0000-4000-8000-000000000002');
insert into public.metal_purchase_lifecycle_events (
  id, user_id, affected_purchase_id, action, replacement_purchase_id,
  funding_reversal_transaction_id
)
values (
  '79000000-0000-4000-8000-000000000002',
  '71000000-0000-4000-8000-000000000001',
  '79000000-0000-4000-8000-000000000001', 'correction',
  '79000000-0000-4000-8000-000000000003',
  '76000000-0000-4000-8000-000000000002'
);

insert into public.goals (
  id, user_id, name, goal_type, target_amount, currency_code
)
values (
  '7a000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000001',
  'Cascade Goal', 'buy_home', 1000, 'USD'
);
insert into public.goal_progress_entries (
  id, goal_id, user_id, entry_type, amount, effective_on
)
values (
  '7a000000-0000-4000-8000-000000000002',
  '7a000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000001', 'progress', 100, current_date
);

insert into public.dashboard_valuation_snapshots (
  user_id, base_currency_code, snapshot, as_of, expires_at
)
values (
  '71000000-0000-4000-8000-000000000001', 'USD', '{}'::jsonb,
  now(), now() + interval '1 hour'
);

select pg_temp.expect_immutable_delete(
  $$delete from public.financial_transactions where id = '76000000-0000-4000-8000-000000000101'$$,
  'is immutable'
);
\echo ok 1 - direct deletion of a posted transaction remains rejected

select pg_temp.expect_immutable_delete(
  $$delete from public.transaction_entries where id = '77000000-0000-4000-8000-000000000101'$$,
  'entries of posted transaction are immutable'
);
\echo ok 2 - direct deletion of a posted transaction entry remains rejected

delete from auth.users
where id = '71000000-0000-4000-8000-000000000001';

set constraints all immediate;
\echo ok 3 - whole Auth user deletion and all deferred references succeed

do $test$
declare
  v_user_id constant uuid := '71000000-0000-4000-8000-000000000001';
  v_remaining bigint;
begin
  select sum(row_count) into v_remaining
  from (
    select count(*) row_count from public.profiles where id = v_user_id
    union all select count(*) from public.financial_accounts where user_id = v_user_id
    union all select count(*) from public.financial_transactions where user_id = v_user_id
    union all select count(*) from public.transaction_entries where user_id = v_user_id
    union all select count(*) from public.record_categories where user_id = v_user_id
    union all select count(*) from public.record_category_overrides where user_id = v_user_id
    union all select count(*) from public.metal_purchases where user_id = v_user_id
    union all select count(*) from public.metal_purchase_lifecycle_events where user_id = v_user_id
    union all select count(*) from public.assets where user_id = v_user_id
    union all select count(*) from public.asset_identifiers where user_id = v_user_id
    union all select count(*) from public.holdings where user_id = v_user_id
    union all select count(*) from public.market_prices where user_id = v_user_id
    union all select count(*) from public.dashboard_valuation_snapshots where user_id = v_user_id
    union all select count(*) from public.account_valuations where user_id = v_user_id
    union all select count(*) from public.account_disposals where user_id = v_user_id
    union all select count(*) from public.goals where user_id = v_user_id
    union all select count(*) from public.goal_progress_entries where user_id = v_user_id
  ) owned_rows;

  if v_remaining <> 0 then
    raise exception 'whole-user deletion left % user-owned rows', v_remaining;
  end if;
end;
$test$;
\echo ok 4 - zero user-owned rows remain across every current domain

do $test$
begin
  if exists (
    select 1 from public.transaction_entries entry
    left join public.financial_transactions transaction on transaction.id = entry.transaction_id
    left join public.financial_accounts account on account.id = entry.account_id
    left join public.assets asset on asset.id = entry.asset_id
    where transaction.id is null
      or (entry.account_id is not null and account.id is null)
      or (entry.asset_id is not null and asset.id is null)
  ) or exists (
    select 1 from public.holdings holding
    left join public.financial_accounts account on account.id = holding.account_id
    left join public.assets asset on asset.id = holding.asset_id
    where account.id is null or asset.id is null
  ) or exists (
    select 1 from public.account_disposals disposal
    left join public.financial_accounts account on account.id = disposal.account_id
    left join public.financial_transactions transaction
      on transaction.id = disposal.proceeds_transaction_id
    where account.id is null
      or (disposal.proceeds_transaction_id is not null and transaction.id is null)
  ) or exists (
    select 1 from public.goal_progress_entries entry
    left join public.goals goal on goal.id = entry.goal_id and goal.user_id = entry.user_id
    where goal.id is null
  ) then
    raise exception 'orphaned user-owned references remain';
  end if;
end;
$test$;
\echo ok 5 - no orphaned ledger, holding, disposal, or Goal references remain

rollback;
