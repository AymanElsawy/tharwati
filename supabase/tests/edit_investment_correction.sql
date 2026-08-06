begin;

\echo 1..8

set local role supabase_auth_admin;
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
('19000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','edit-a@example.invalid','',now(),'{}','{}',now(),now()),
('19000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','edit-b@example.invalid','',now(),'{}','{}',now(),now());
reset role;

insert into public.financial_accounts (id,user_id,account_type_code,name,currency_code,opening_balance)
values ('29000000-0000-4000-8000-000000000001','19000000-0000-4000-8000-000000000001','brokerage','Edit Brokerage','USD',10000);

select pg_catalog.set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select (public.add_investment(
  '29000000-0000-4000-8000-000000000001',null,null,null,
  null,'stock','Edit Test Asset','EDIT','USD','XTEST','ticker','XTEST','EDIT',null,
  2,100,1,now() - interval '2 days','original'
)->'transaction'->>'id') as original_id \gset

select public.edit_investment(:'original_id',3,100,5,now() - interval '1 day','corrected');
reset role;

do $test$
declare v_holding public.holdings%rowtype; v_reversal_count int; v_replacement_count int;
begin
  select * into strict v_holding from public.holdings
  where user_id='19000000-0000-4000-8000-000000000001' and account_id='29000000-0000-4000-8000-000000000001';
  if v_holding.quantity <> 3 or v_holding.total_cost_basis <> 305 or v_holding.average_cost <> round(305::numeric/3, 10) then
    raise exception 'corrected holding is not exact: %', row_to_json(v_holding);
  end if;
  select count(*) into v_reversal_count from public.financial_transactions where reverses_transaction_id=:'original_id';
  select count(*) into v_replacement_count from public.financial_transactions where corrects_transaction_id=:'original_id';
  if v_reversal_count<>1 or v_replacement_count<>1 then raise exception 'correction traceability is incomplete'; end if;
end;$test$;
\echo ok 1 - correction produces one exact holding and linked immutable records

do $test$ begin
  if exists(select 1 from public.financial_transactions where id=:'original_id' and (status<>'posted' or notes<>'original')) then
    raise exception 'original transaction changed';
  end if;
end;$test$;
\echo ok 2 - original posted transaction remains unchanged

select pg_catalog.set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $test$ begin
  perform public.edit_investment(:'original_id',4,100,0,now(),'forbidden');
  raise exception 'ownership rejection did not occur';
exception when no_data_found then null; when others then if sqlstate <> 'P0002' then raise; end if;
end;$test$;
reset role;
\echo ok 3 - another user cannot edit the investment

select pg_catalog.set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $test$ begin perform public.edit_investment(gen_random_uuid(),1,1,0,now(),null); raise exception 'missing rejection did not occur'; exception when others then if sqlstate <> 'P0002' then raise; end if; end;$test$;
\echo ok 4 - missing investment is rejected
do $test$ begin perform public.edit_investment(:'original_id',0,1,0,now(),null); raise exception 'quantity rejection did not occur'; exception when others then if sqlstate <> '22023' then raise; end if; end;$test$;
\echo ok 5 - invalid quantity is rejected
do $test$ begin perform public.edit_investment(:'original_id',1,-1,0,now(),null); raise exception 'price rejection did not occur'; exception when others then if sqlstate <> '22023' then raise; end if; end;$test$;
\echo ok 6 - invalid price is rejected
do $test$ begin perform public.edit_investment(:'original_id',1,1,-1,now(),null); raise exception 'fee rejection did not occur'; exception when others then if sqlstate <> '22023' then raise; end if; end;$test$;
\echo ok 7 - invalid fees are rejected
do $test$ declare v_before int; v_after int; begin
  select count(*) into v_before from public.financial_transactions;
  begin perform public.edit_investment(:'original_id',4,100,0,now(),null); exception when unique_violation then null; end;
  select count(*) into v_after from public.financial_transactions;
  if v_before<>v_after then raise exception 'failed correction left partial records'; end if;
end;$test$;
reset role;
\echo ok 8 - failed repeat correction rolls back atomically

rollback;
