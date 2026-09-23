begin;

\echo 1..9

create or replace function pg_temp.expect_failure(p_statement text)
returns void language plpgsql as $$
begin
  execute p_statement;
  raise exception 'statement unexpectedly succeeded';
exception
  when others then
    if sqlerrm = 'statement unexpectedly succeeded' then raise; end if;
end;
$$;

insert into auth.users (id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
 ('91000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','brokerage-v2-1@example.invalid','','{}','{}',now(),now()),
 ('91000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','brokerage-v2-2@example.invalid','','{}','{}',now(),now());

insert into public.financial_accounts (id,user_id,account_type_code,name,currency_code,opening_balance,is_active,investment_type)
values
 ('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','brokerage','USD Brokerage','USD',10000,true,'stock_etf'),
 ('92000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000001','brokerage','SAR Brokerage','SAR',1000,true,'stock_etf'),
 ('92000000-0000-4000-8000-000000000003','91000000-0000-4000-8000-000000000002','brokerage','Other Brokerage','USD',1000,true,'stock_etf');

insert into public.assets (id,user_id,asset_type_code,symbol,name,currency_code,exchange,is_custom,is_active,canonical_quantity_unit)
values
 ('93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','stock','IDEM','Idempotency Asset','USD','XTEST',true,true,'shares'),
 ('93000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000002','stock','OTHER','Other Asset','USD','XTEST',true,true,'shares');

select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.add_existing_holding('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001',10,10,'2026-09-24T08:00:00Z','opening',null);

create temporary table brokerage_first(operation text,result jsonb);
insert into brokerage_first values
 ('buy',public.add_brokerage_buy_v2('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001',1,10,'94000000-0000-4000-8000-000000000001','2026-09-24T10:00:00Z',' buy ',0,null)),
 ('sell',public.add_brokerage_sell_v2('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001',1,12,'94000000-0000-4000-8000-000000000002','2026-09-24T10:01:00Z',' sell ',0,null)),
 ('cash',public.add_brokerage_cash_dividend_v2('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001',10,'94000000-0000-4000-8000-000000000003',0,0,'2026-09-24T10:02:00Z',' cash ')),
 ('full',public.add_brokerage_dividend_reinvestment_v2('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001',10,2,'94000000-0000-4000-8000-000000000004',0,0,'2026-09-24T10:03:00Z',' full ')),
 ('partial',public.add_brokerage_partial_dividend_reinvestment_v2('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001',10,6,2,'94000000-0000-4000-8000-000000000005',0,0,'2026-09-24T10:04:00Z',' partial '));

create temporary table brokerage_replay(operation text,result jsonb);
insert into brokerage_replay values
 ('buy',public.add_brokerage_buy_v2('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001',1.00,10.0,'94000000-0000-4000-8000-000000000001','2026-09-24T13:00:00+03','buy',0.00,null)),
 ('sell',public.add_brokerage_sell_v2('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001',1.0,12.00,'94000000-0000-4000-8000-000000000002','2026-09-24T13:01:00+03','sell',0,null)),
 ('cash',public.add_brokerage_cash_dividend_v2('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001',10.00,'94000000-0000-4000-8000-000000000003',0.0,0.00,'2026-09-24T13:02:00+03','cash')),
 ('full',public.add_brokerage_dividend_reinvestment_v2('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001',10.0,2.00,'94000000-0000-4000-8000-000000000004',0,0,'2026-09-24T13:03:00+03','full')),
 ('partial',public.add_brokerage_partial_dividend_reinvestment_v2('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001',10.00,6.0,2.0,'94000000-0000-4000-8000-000000000005',0,0,'2026-09-24T13:04:00+03','partial'));
reset role;

do $test$ begin
 if exists (select 1 from brokerage_first f join brokerage_replay r using(operation) where f.result#>>'{transaction,id}'<>r.result#>>'{transaction,id}' or f.result->>'replayed'<>'false' or r.result->>'replayed'<>'true')
   or (select count(*) from private.account_record_mutation_receipts where user_id='91000000-0000-4000-8000-000000000001' and operation like 'add_brokerage_%_v2')<>5
 then raise exception 'first/replay contract failed'; end if;
end $test$;
\echo ok 1 - all five operations commit once and normalized replays return the original result

select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select pg_temp.expect_failure($$select public.add_brokerage_buy_v2('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001',2,10,'94000000-0000-4000-8000-000000000001','2026-09-24T10:00:00Z','buy',0,null)$$);
select pg_temp.expect_failure($$select public.add_brokerage_cash_dividend_v2('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001',11,'94000000-0000-4000-8000-000000000003',0,0,'2026-09-24T10:02:00Z','cash')$$);
reset role;
\echo ok 2 - changed payload reuse is rejected

do $test$ declare c numeric;q numeric;b numeric; begin
 select current_balance::numeric into c from public.get_account_balances(array['92000000-0000-4000-8000-000000000001'::uuid]);
 select quantity,total_cost_basis into q,b from public.holdings where account_id='92000000-0000-4000-8000-000000000001' and asset_id='93000000-0000-4000-8000-000000000001';
 if c<>10016 or q<>18 or b<>116 then raise exception 'financial effects changed: %, %, %',c,q,b; end if;
end $test$;
\echo ok 3 - Buy Sell and all dividend cash quantity and cost-basis effects are unchanged

do $test$ begin
 if exists (select 1 from public.transaction_entries e join public.financial_transactions t on t.id=e.transaction_id where t.notes in ('cash','full','partial') and e.memo in ('brokerage_dividend_tax','brokerage_dividend_fee')) then raise exception 'zero dividend legs persisted'; end if;
end $test$;
\echo ok 4 - zero tax and fee dividend legs remain omitted

select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.add_brokerage_buy_v2('92000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000001',2,10,'94000000-0000-4000-8000-000000000006','2026-09-24T11:00:00Z','cross buy',0,3.75);
select public.add_brokerage_sell_v2('92000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000001',1,12,'94000000-0000-4000-8000-000000000007','2026-09-24T11:01:00Z','cross sell',0,3.8);
reset role;
do $test$ declare c numeric;q numeric;b numeric; begin
 select current_balance::numeric into c from public.get_account_balances(array['92000000-0000-4000-8000-000000000002'::uuid]);
 select quantity,total_cost_basis into q,b from public.holdings where account_id='92000000-0000-4000-8000-000000000002' and asset_id='93000000-0000-4000-8000-000000000001';
 if c<>970.6 or q<>1 or b<>37.5 then raise exception 'cross-currency effects changed: %, %, %',c,q,b; end if;
end $test$;
\echo ok 5 - cross-currency Buy and Sell FX effects are unchanged

select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select public.add_existing_holding('92000000-0000-4000-8000-000000000003','93000000-0000-4000-8000-000000000002',1,1,'2026-09-24T08:00:00Z',null,null);
select public.add_brokerage_cash_dividend_v2('92000000-0000-4000-8000-000000000003','93000000-0000-4000-8000-000000000002',1,'94000000-0000-4000-8000-000000000003',0,0,'2026-09-24T10:02:00Z','other');
reset role;
do $test$ begin
 if (select count(*) from private.account_record_mutation_receipts where idempotency_key='94000000-0000-4000-8000-000000000003')<>2 then raise exception 'user isolation failed'; end if;
end $test$;
\echo ok 6 - the same UUID is independently scoped by authenticated user

select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select pg_temp.expect_failure($$select public.add_brokerage_buy_v2('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001',99999,99999,'94000000-0000-4000-8000-000000000008',now(),null,0,null)$$);
select pg_temp.expect_failure($$select public.add_brokerage_sell_v2('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001',99999,1,'94000000-0000-4000-8000-000000000009',now(),null,0,null)$$);
select pg_temp.expect_failure($$select public.add_brokerage_partial_dividend_reinvestment_v2('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001',10,20,2,'94000000-0000-4000-8000-000000000010',0,0,now(),null)$$);
select pg_temp.expect_failure($$select public.add_brokerage_cash_dividend_v2('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001',10,'94000000-0000-4000-8000-000000000011',10,0,now(),null)$$);
select pg_temp.expect_failure($$select public.add_brokerage_dividend_reinvestment_v2('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000002',10,2,'94000000-0000-4000-8000-000000000012',0,0,now(),null)$$);
reset role;
do $test$ begin
 if exists (select 1 from private.account_record_mutation_receipts where idempotency_key in ('94000000-0000-4000-8000-000000000008','94000000-0000-4000-8000-000000000009','94000000-0000-4000-8000-000000000010','94000000-0000-4000-8000-000000000011','94000000-0000-4000-8000-000000000012')) then raise exception 'failed mutation left receipt'; end if;
end $test$;
\echo ok 7 - insufficient cash quantity invalid dividend split and holding roll back without receipts

do $test$ begin
 if has_table_privilege('authenticated','private.account_record_mutation_receipts','select')
 or has_table_privilege('authenticated','private.account_record_mutation_receipts','insert')
 or has_function_privilege('anon','public.add_brokerage_buy_v2(uuid,uuid,numeric,numeric,uuid,timestamptz,text,numeric,numeric)','execute')
 or not has_function_privilege('authenticated','public.add_brokerage_buy_v2(uuid,uuid,numeric,numeric,uuid,timestamptz,text,numeric,numeric)','execute')
 then raise exception 'receipt/RPC grants are incorrect'; end if;
end $test$;
\echo ok 8 - receipt access and v2 grants remain server-private

do $test$ begin
 if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'add_brokerage%_v2' and (not p.prosecdef or coalesce(array_to_string(p.proconfig,','),'') not like '%search_path=%')) then raise exception 'v2 function security is incorrect'; end if;
end $test$;
\echo ok 9 - all v2 wrappers are SECURITY DEFINER with fixed search_path

rollback;
