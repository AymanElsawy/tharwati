begin;

\echo 1..6

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('81000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','record-idempotency-1@example.invalid','','{}','{}',now(),now()),
  ('81000000-0000-4000-8000-000000000002','00000000-0000-0000-8000-000000000000','authenticated','authenticated','record-idempotency-2@example.invalid','','{}','{}',now(),now());

insert into public.financial_accounts (id,user_id,account_type_code,name,currency_code,opening_balance,bank_subtype)
values
  ('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','cash','Source USD','USD',1000,null),
  ('82000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000001','cash','Destination USD','USD',100,null),
  ('82000000-0000-4000-8000-000000000003','81000000-0000-4000-8000-000000000001','cash','Destination SAR','SAR',100,null),
  ('82000000-0000-4000-8000-000000000004','81000000-0000-4000-8000-000000000002','cash','Other user','USD',1000,null);

select pg_catalog.set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
set local role authenticated;

create temporary table first_result as
select public.add_account_record_v2(
  'income','82000000-0000-4000-8000-000000000001',null,10.00,null,
  '2026-09-23T10:00:00Z','Salary',' note ','83000000-0000-4000-8000-000000000001',null,null
) result;

create temporary table replay_result as
select public.add_account_record_v2(
  'income','82000000-0000-4000-8000-000000000001',null,10.0,null,
  '2026-09-23T13:00:00+03','Salary','note','83000000-0000-4000-8000-000000000001',null,null
) result;

reset role;
do $test$ begin
  if (select result->>'replayed' from first_result) <> 'false'
    or (select result->>'replayed' from replay_result) <> 'true'
    or (select result#>>'{transaction,id}' from first_result) <> (select result#>>'{transaction,id}' from replay_result)
    or (select count(*) from public.financial_transactions where user_id='81000000-0000-4000-8000-000000000001' and transaction_type_code='income') <> 1
  then raise exception 'first submission or exact replay contract failed'; end if;
end $test$;
\echo ok 1 - first submission commits once and normalized replay returns the original result

set local role authenticated;
do $test$ begin
  perform public.add_account_record_v2(
    'income','82000000-0000-4000-8000-000000000001',null,11,null,
    '2026-09-23T10:00:00Z','Salary','note','83000000-0000-4000-8000-000000000001',null,null
  );
  raise exception 'changed payload replay succeeded';
exception when invalid_parameter_value then null;
end $test$;
reset role;
\echo ok 2 - changed payload with the same key is rejected

set local role authenticated;
select public.add_account_record_v2('expense','82000000-0000-4000-8000-000000000001',null,25,null,'2026-09-23T11:00:00Z','Food',null,'83000000-0000-4000-8000-000000000002',null,null);
select public.add_account_record_v2('transfer','82000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000002',40,999,'2026-09-23T12:00:00Z',null,null,'83000000-0000-4000-8000-000000000003',null,null);
select public.add_account_record_v2('transfer','82000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000003',20,75.50,'2026-09-23T13:00:00Z',null,null,'83000000-0000-4000-8000-000000000004',null,null);
reset role;
do $test$ declare source_balance numeric; usd_balance numeric; sar_balance numeric; begin
  select current_balance::numeric into source_balance from public.get_account_balances(array['82000000-0000-4000-8000-000000000001'::uuid]);
  select current_balance::numeric into usd_balance from public.get_account_balances(array['82000000-0000-4000-8000-000000000002'::uuid]);
  select current_balance::numeric into sar_balance from public.get_account_balances(array['82000000-0000-4000-8000-000000000003'::uuid]);
  if source_balance <> 925 or usd_balance <> 140 or sar_balance <> 175.50 then
    raise exception 'financial effects changed: %, %, %', source_balance, usd_balance, sar_balance;
  end if;
end $test$;
\echo ok 3 - Income Expense and same/cross-currency Transfer effects are unchanged

select pg_catalog.set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select public.add_account_record_v2('income','82000000-0000-4000-8000-000000000004',null,10,null,'2026-09-23T10:00:00Z','Salary','note','83000000-0000-4000-8000-000000000001',null,null);
reset role;
do $test$ begin
  if (select count(*) from private.account_record_mutation_receipts where idempotency_key='83000000-0000-4000-8000-000000000001') <> 2 then
    raise exception 'user-scoped key isolation failed';
  end if;
end $test$;
\echo ok 4 - the same key is isolated by authenticated user

select pg_catalog.set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $test$ begin
  perform public.add_account_record_v2('expense','82000000-0000-4000-8000-000000000001',null,999999,null,'2026-09-23T14:00:00Z','Food',null,'83000000-0000-4000-8000-000000000005',null,null);
  raise exception 'invalid financial mutation succeeded';
exception when no_data_found then null;
end $test$;
reset role;
do $test$ begin
  if exists (select 1 from private.account_record_mutation_receipts where user_id='81000000-0000-4000-8000-000000000001' and idempotency_key='83000000-0000-4000-8000-000000000005') then
    raise exception 'failed mutation left a receipt';
  end if;
end $test$;
\echo ok 5 - financial failure rolls back without a receipt

do $test$ begin
  if has_table_privilege('authenticated','private.account_record_mutation_receipts','select')
    or has_table_privilege('authenticated','private.account_record_mutation_receipts','insert')
    or has_table_privilege('authenticated','private.account_record_mutation_receipts','update')
    or has_table_privilege('authenticated','private.account_record_mutation_receipts','delete')
  then raise exception 'authenticated has direct receipt access'; end if;
end $test$;
\echo ok 6 - receipts have no direct authenticated table access

rollback;
