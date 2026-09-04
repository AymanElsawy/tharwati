begin;

\echo 1..8

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('81000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'export-one@example.invalid', '', '{}', '{}', now(), now()),
  ('81000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'export-two@example.invalid', '', '{}', '{}', now(), now());

insert into public.account_types (code, name) values ('cash', 'Cash') on conflict (code) do nothing;
insert into public.asset_types (code, name) values ('stock', 'Stock') on conflict (code) do nothing;

insert into public.financial_accounts (
  id, user_id, account_type_code, name, currency_code, opening_balance, created_at
) values
  ('82000000-0000-4000-8000-000000000002', '81000000-0000-4000-8000-000000000001', 'cash', 'Second', 'USD', 20.20, '2026-01-02'),
  ('82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', 'cash', 'First', 'USD', 10.10, '2026-01-01'),
  ('82000000-0000-4000-8000-000000000003', '81000000-0000-4000-8000-000000000002', 'cash', 'Other', 'USD', 99.99, '2026-01-01');

insert into public.goals (
  id, user_id, name, goal_type, target_amount, currency_code, created_at
) values
  ('83000000-0000-4000-8000-000000000002', '81000000-0000-4000-8000-000000000001', 'Later', 'travel', 200.20, 'USD', '2026-01-02'),
  ('83000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', 'Earlier', 'travel', 100.10, 'USD', '2026-01-01'),
  ('83000000-0000-4000-8000-000000000003', '81000000-0000-4000-8000-000000000002', 'Private', 'travel', 999.99, 'USD', '2026-01-01');

insert into public.goal_progress_entries (
  id, goal_id, user_id, entry_type, amount, effective_on, created_at
) values (
  '84000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000001', 'progress', 12.34, current_date, '2026-01-01'
);

insert into public.assets (
  id, user_id, asset_type_code, symbol, name, currency_code, is_custom, canonical_quantity_unit
) values
  ('85000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', 'stock', 'OWN', 'Owned', 'USD', true, 'shares'),
  ('85000000-0000-4000-8000-000000000002', '81000000-0000-4000-8000-000000000002', 'stock', 'OTHER', 'Other', 'USD', true, 'shares'),
  ('85000000-0000-4000-8000-000000000003', null, 'stock', 'GLOBAL', 'Global catalog', 'USD', false, 'shares');

insert into public.market_prices (
  id, user_id, asset_id, provider, price, currency_code, as_of, fetched_at, price_type
) values
  ('86000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', '85000000-0000-4000-8000-000000000001', 'manual', 12.3456000000, 'USD', now(), now(), 'manual'),
  ('86000000-0000-4000-8000-000000000002', '81000000-0000-4000-8000-000000000002', '85000000-0000-4000-8000-000000000002', 'manual', 99, 'USD', now(), now(), 'manual'),
  ('86000000-0000-4000-8000-000000000003', null, '85000000-0000-4000-8000-000000000003', 'provider', 88, 'USD', now(), now(), 'delayed');

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

create temp table export_result as select public.export_my_data_v1() document;

do $test$
declare v jsonb := (select document from export_result);
begin
  if v->>'schema' <> 'tharwati.user-data-export' or (v->>'version')::integer <> 1 then
    raise exception 'wrong export contract/version';
  end if;
  if v#>>'{subject,user_id}' <> '81000000-0000-4000-8000-000000000001' then
    raise exception 'wrong export subject';
  end if;
end $test$;
\echo ok 1 - contract and authenticated subject are correct

do $test$
declare v jsonb := (select document from export_result);
begin
  if pg_catalog.jsonb_array_length(v#>'{data,financial_accounts}') <> 2
    or (v#>'{data,financial_accounts,0}'->>'id') <> '82000000-0000-4000-8000-000000000001'
    or pg_catalog.jsonb_array_length(v#>'{data,goals}') <> 2
    or (v#>'{data,goals,0}'->>'id') <> '83000000-0000-4000-8000-000000000001' then
    raise exception 'ownership isolation or deterministic ordering failed';
  end if;
end $test$;
\echo ok 2 - ownership isolation and deterministic ordering hold

do $test$
declare v jsonb := (select document from export_result);
begin
  if pg_catalog.jsonb_typeof(v#>'{data,financial_accounts,0,opening_balance}') <> 'string'
    or pg_catalog.jsonb_typeof(v#>'{data,goals,0,target_amount}') <> 'string'
    or pg_catalog.jsonb_typeof(v#>'{data,goal_progress_entries,0,amount}') <> 'string'
    or pg_catalog.jsonb_typeof(v#>'{data,manual_market_prices,0,price}') <> 'string' then
    raise exception 'a monetary value was emitted as a JSON number';
  end if;
end $test$;
\echo ok 3 - money and quantities are decimal strings

do $test$
declare v jsonb := (select document from export_result);
begin
  if pg_catalog.jsonb_array_length(v#>'{data,manual_market_prices}') <> 1
    or v#>>'{data,manual_market_prices,0,user_id}' <> '81000000-0000-4000-8000-000000000001' then
    raise exception 'manual price isolation failed';
  end if;
end $test$;
\echo ok 4 - only caller-owned manual prices are exported

do $test$
declare v jsonb := (select document from export_result);
begin
  if v->'data' ?| array['dashboard_valuation_snapshots','exchange_rates','financial_settings',
    'currencies','account_types','asset_types','transaction_types','provider_market_prices',
    'logs','auth_identities','auth_metadata'] then
    raise exception 'excluded data key is present';
  end if;
end $test$;
\echo ok 5 - shared caches, catalogs, snapshots, stale tables, and Auth internals are excluded

do $test$
begin
  perform public.export_my_data_v1();
  raise exception 'rate limit did not reject a second export';
exception when others then
  if sqlerrm <> 'export_rate_limited' then raise; end if;
end $test$;
\echo ok 6 - authenticated rate limiting is database-backed

reset role;

do $test$
begin
  if has_function_privilege('public', 'public.export_my_data_v1()', 'execute')
    or has_function_privilege('anon', 'public.export_my_data_v1()', 'execute') then
    raise exception 'public or anon can execute export RPC';
  end if;
end $test$;
\echo ok 7 - public and anon cannot execute the RPC

select pg_catalog.set_config('request.jwt.claims', '{}', true);
do $test$
begin
  perform public.export_my_data_v1();
  raise exception 'unauthenticated export unexpectedly succeeded';
exception when insufficient_privilege then null;
end $test$;
\echo ok 8 - missing authenticated identity is rejected

rollback;
