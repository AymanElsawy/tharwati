-- Run with psql -v ON_ERROR_STOP=1 against a disposable remote-schema clone.
\o /dev/null
begin;
create function pg_temp.assert_true(ok boolean, label text) returns void
language plpgsql as $$ begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
end $$;
create function pg_temp.expect_error(statement text, expected_state text, expected_constraint text default null) returns void
language plpgsql as $$ declare actual_constraint text; begin
  begin execute statement;
  exception when others then
    get stacked diagnostics actual_constraint = constraint_name;
    if sqlstate = expected_state and (expected_constraint is null or actual_constraint = expected_constraint) then return; end if;
    raise;
  end;
  raise exception 'statement unexpectedly succeeded: %', statement;
end $$;

-- Synthetic fixtures shared by the concurrency test (which extracts this block).
-- BEGIN FIXTURES
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('91000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','immutable-a@example.invalid','','{}','{}',now(),now()),
('91000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','immutable-b@example.invalid','','{}','{}',now(),now());
insert into public.financial_accounts(id,user_id,account_type_code,name,currency_code,opening_balance,metal_type,investment_type,ownership_percentage,initial_ownership_percentage,business_type) values
('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','cash','Funding','USD',1000,null,null,null,null,null),
('92000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000001','gold','Gold','USD',0,'gold',null,null,null,null),
('92000000-0000-4000-8000-000000000003','91000000-0000-4000-8000-000000000001','brokerage','Brokerage','USD',1000,null,'stock_etf',null,null,null),
('92000000-0000-4000-8000-000000000004','91000000-0000-4000-8000-000000000001','business','Business','USD',0,null,null,100,100,'company'),
('92000000-0000-4000-8000-000000000005','91000000-0000-4000-8000-000000000001','cash','Pristine','USD',0,null,null,null,null,null),
('92000000-0000-4000-8000-000000000006','91000000-0000-4000-8000-000000000002','cash','Other owner','USD',0,null,null,null,null,null);
insert into public.assets(id,user_id,asset_type_code,symbol,name,currency_code,exchange,is_custom,is_active,canonical_quantity_unit) values
('93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','stock','IMM','Immutability','USD','XTEST',true,true,'shares');
-- END FIXTURES

select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select pg_temp.expect_error($q$insert into public.metal_purchases(user_id,account_id,purity,purchased_at,quantity_grams,cost_per_unit,funding_mode)
values(auth.uid(),'92000000-0000-4000-8000-000000000002','24k',now(),1,10,'external')$q$, '42501');
select public.add_metal_purchase_v2('92000000-0000-4000-8000-000000000002','24k',now(),2,10,'cash_account','92000000-0000-4000-8000-000000000001',1,gen_random_uuid(),'original');
select public.add_account_valuation_v2('92000000-0000-4000-8000-000000000004',1000,current_date,gen_random_uuid(),'owner_estimate','original');
select public.add_account_disposal('92000000-0000-4000-8000-000000000004',current_date,0,'USD',10,gen_random_uuid(),'original');
select public.add_existing_holding_v2('92000000-0000-4000-8000-000000000003','93000000-0000-4000-8000-000000000001',2,10,gen_random_uuid(),now(),'original',null);
reset role;
create temporary table original_history as
select 'metal_purchases'::text table_name,id,to_jsonb(p) snapshot from public.metal_purchases p
union all select 'account_valuations',id,to_jsonb(v) from public.account_valuations v
union all select 'account_disposals',id,to_jsonb(d) from public.account_disposals d
union all select 'financial_transactions',id,to_jsonb(t) from public.financial_transactions t
union all select 'transaction_entries',id,to_jsonb(e) from public.transaction_entries e;
grant select on original_history to authenticated;

set local role authenticated;
select public.correct_metal_purchase((select id from original_history where table_name='metal_purchases'),'22k',now(),3,10,'cash_account','92000000-0000-4000-8000-000000000001',0,'replacement');
select public.correct_account_valuation((select id from original_history where table_name='account_valuations'),1100,current_date,'owner_estimate','replacement');
select public.correct_account_disposal((select id from original_history where table_name='account_disposals'),current_date,0,'USD',20,'replacement');
select public.correct_existing_holding((select id from public.financial_transactions where transaction_type_code='opening_position'),3,10,now(),'replacement',null);
select pg_temp.assert_true((select quantity=3 and total_cost_basis=30 from public.holdings where account_id='92000000-0000-4000-8000-000000000003'),'holding correction projection');
select pg_temp.assert_true((select opening_balance=1000 from public.financial_accounts where id='92000000-0000-4000-8000-000000000003'),'holding correction leaves opening balance');
select pg_temp.assert_true((select balance_grams=3 from public.financial_accounts where id='92000000-0000-4000-8000-000000000002'),'metal correction projection');
select pg_temp.assert_true((select ownership_percentage=80 from public.financial_accounts where id='92000000-0000-4000-8000-000000000004'),'disposal correction projection');
select public.reverse_metal_purchase((select id from public.get_effective_metal_purchases(array['92000000-0000-4000-8000-000000000002'::uuid])));
select pg_temp.assert_true((select current_balance::numeric=1000 from public.get_account_balances(array['92000000-0000-4000-8000-000000000001'::uuid])),'metal correction and reversal restore cash');
select public.reverse_existing_holding((select id from public.financial_transactions where transaction_type_code='opening_position' and corrects_transaction_id is not null));
select pg_temp.assert_true(not exists(select 1 from public.holdings where account_id='92000000-0000-4000-8000-000000000003' and quantity<>0),'holding reversal projection');
reset role;

-- Privileged writers must also be rejected; no role-based exception.
do $$ declare t text; r record; actual jsonb; begin
  foreach t in array array['metal_purchases','metal_purchase_lifecycle_events','account_valuations','account_disposals'] loop
    perform pg_temp.assert_true((select count(*)>0 from pg_class where oid=('public.'||t)::regclass),t);
    perform pg_temp.expect_error(format('update public.%I set id=id',t),'55000');
    perform pg_temp.expect_error(format('delete from public.%I',t),'55000');
  end loop;
  for r in select * from original_history loop
    execute format('select to_jsonb(t) from public.%I t where id=$1',r.table_name) into actual using r.id;
    perform pg_temp.assert_true(actual = r.snapshot,'original row preserved: '||r.table_name);
  end loop;
end $$;
set local role service_role;
select pg_temp.expect_error('update public.metal_purchases set id=id','55000');
select pg_temp.expect_error('delete from public.account_valuations','55000');
reset role;
\echo PASS RPC creation, correction/reversal projections, original rows and four privileged history guards

-- All three history-sensitive fields reject, including ineffective history.
set local role authenticated;
do $$ declare a uuid; begin
  foreach a in array array[
    '92000000-0000-4000-8000-000000000001'::uuid,
    '92000000-0000-4000-8000-000000000002'::uuid,
    '92000000-0000-4000-8000-000000000003'::uuid,
    '92000000-0000-4000-8000-000000000004'::uuid
  ] loop
    perform pg_temp.expect_error(format('update public.financial_accounts set opening_balance=opening_balance+1 where id=%L',a),'23514','financial_accounts_opening_balance_immutable_after_history_check');
    perform pg_temp.expect_error(format('update public.financial_accounts set currency_code=''EUR'' where id=%L',a),'23514','financial_accounts_currency_immutable_after_history_check');
    perform pg_temp.expect_error(format('update public.financial_accounts set account_type_code=''other'' where id=%L',a),'23514','financial_accounts_type_immutable_after_history_check');
  end loop;
end $$;
update public.financial_accounts set name=name||' renamed',notes='metadata',
 opening_balance=opening_balance,currency_code=currency_code,account_type_code=account_type_code
where user_id=auth.uid();
update public.financial_accounts set opening_balance=12,currency_code='EUR',account_type_code='other'
where id='92000000-0000-4000-8000-000000000005';
select pg_temp.assert_true((select opening_balance=12 and currency_code='EUR' and account_type_code='other' from public.financial_accounts where id='92000000-0000-4000-8000-000000000005'),'pristine edits');
update public.financial_accounts set opening_balance=0 where id='92000000-0000-4000-8000-000000000005';
select public.close_financial_account('92000000-0000-4000-8000-000000000005');
select public.reopen_financial_account('92000000-0000-4000-8000-000000000005');
select public.delete_pristine_financial_account('92000000-0000-4000-8000-000000000005');
select public.close_financial_account('92000000-0000-4000-8000-000000000002');
select public.reopen_financial_account('92000000-0000-4000-8000-000000000002');
reset role;
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select pg_temp.assert_true(not exists(select 1 from public.metal_purchases),'metal RLS isolation');
update public.financial_accounts set notes='other owner write' where id='92000000-0000-4000-8000-000000000001';
reset role;
select pg_temp.assert_true((select notes='metadata' from public.financial_accounts where id='92000000-0000-4000-8000-000000000001'),'account RLS isolation');
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true);
\echo PASS historical account fields, harmless edits, pristine lifecycle and owner isolation

-- Draft construction, moves between drafts, then protection of BOTH parents.
insert into public.financial_transactions(id,user_id,transaction_type_code,transaction_currency_code,status,occurred_at,description)
select ('94000000-0000-4000-8000-00000000000'||n)::uuid,'91000000-0000-4000-8000-000000000001','income','USD','draft',now(),'Draft fixture' from generate_series(1,2) n;
insert into public.transaction_entries(id,transaction_id,user_id,account_id,entry_side,transaction_amount,account_amount,memo) values
('95000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','debit',10,10,null),
('95000000-0000-4000-8000-000000000002','94000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001',null,'credit',10,10,'owner_contribution');
update public.transaction_entries set transaction_id='94000000-0000-4000-8000-000000000002' where id='95000000-0000-4000-8000-000000000001';
update public.transaction_entries set transaction_id='94000000-0000-4000-8000-000000000001' where id='95000000-0000-4000-8000-000000000001';
set local role authenticated;
select public.post_transaction('94000000-0000-4000-8000-000000000001');
reset role;
select pg_temp.expect_error($q$update public.transaction_entries set transaction_id='94000000-0000-4000-8000-000000000002' where id='95000000-0000-4000-8000-000000000001'$q$,'55000');
insert into public.transaction_entries(id,transaction_id,user_id,account_id,entry_side,transaction_amount,account_amount)
values('95000000-0000-4000-8000-000000000003','94000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','debit',1,1);
select pg_temp.expect_error($q$update public.transaction_entries set transaction_id='94000000-0000-4000-8000-000000000001' where id='95000000-0000-4000-8000-000000000003'$q$,'55000');
delete from public.transaction_entries where id='95000000-0000-4000-8000-000000000003';
select pg_temp.expect_error($q$delete from public.transaction_entries where id='95000000-0000-4000-8000-000000000001'$q$,'55000');
\echo PASS draft construction/posting and posted source/destination protection

-- Refund cancellation and ordinary correction still append.
set local role authenticated;
select public.add_account_record('expense','92000000-0000-4000-8000-000000000001',null,20,null,now(),'Food','expense');
select public.add_expense_refund((select id from public.financial_transactions where transaction_type_code='expense'),5,now(),gen_random_uuid());
select public.cancel_expense_refund((select id from public.financial_transactions where transaction_type_code='refund'),gen_random_uuid());
select public.correct_account_record((select id from public.financial_transactions where transaction_type_code='expense'),'expense','92000000-0000-4000-8000-000000000001',null,15,null,now(),'Food','corrected');
select pg_temp.assert_true((select count(*)=1 from public.financial_transactions where transaction_type_code='refund'),'refund retained');
select pg_temp.assert_true((select count(*)=1 from public.financial_transactions where transaction_type_code='refund_cancellation'),'cancellation appended');
reset role;
\echo PASS refund cancellation and ordinary correction

-- Catalog assertions cover effective grants and fixed trigger search paths.
do $$ declare p text; t text; begin
  foreach p in array array['INSERT','UPDATE','DELETE','MAINTAIN'] loop
    perform pg_temp.assert_true(not has_table_privilege('authenticated','public.metal_purchases',p),'metal privilege '||p);
    perform pg_temp.assert_true(not has_table_privilege('anon','public.metal_purchases',p),'anon metal privilege '||p);
  end loop;
  perform pg_temp.assert_true(has_table_privilege('authenticated','public.metal_purchases','SELECT'),'metal SELECT');
  perform pg_temp.assert_true(not exists(select 1 from pg_policy where polrelid='public.metal_purchases'::regclass and polcmd in ('a','*')),'no metal INSERT policy');
  foreach t in array array['metal_purchases','metal_purchase_lifecycle_events','account_valuations','account_disposals','financial_accounts','financial_transactions','transaction_entries'] loop
    perform pg_temp.assert_true((select relrowsecurity from pg_class where oid=('public.'||t)::regclass),'RLS '||t);
  end loop;
  foreach p in array array['prevent_financial_history_changes','prevent_posted_account_record_entry_changes','prevent_account_history_field_changes'] loop
    perform pg_temp.assert_true((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid=('public.'||p||'()')::regprocedure),'fixed search_path '||p);
    perform pg_temp.assert_true(not has_function_privilege('authenticated','public.'||p||'()','EXECUTE'),'trigger not RPC '||p);
    perform pg_temp.assert_true(not has_function_privilege('anon','public.'||p||'()','EXECUTE'),'anon trigger '||p);
  end loop;
end $$;
\echo PASS grants, RLS and trigger exposure/search_path

-- Delete only the synthetic owner and force deferred cross-link checks now.
delete from auth.users where id='91000000-0000-4000-8000-000000000001';
set constraints all immediate;
do $$ declare t text; n bigint; begin
  foreach t in array array['metal_purchases','metal_purchase_lifecycle_events','account_valuations','account_disposals','financial_accounts','financial_transactions','transaction_entries','holdings'] loop
    execute format('select count(*) from public.%I where user_id=%L',t,'91000000-0000-4000-8000-000000000001') into n;
    perform pg_temp.assert_true(n=0,'whole-user cascade '||t);
  end loop;
  perform pg_temp.assert_true(exists(select 1 from public.financial_accounts where id='92000000-0000-4000-8000-000000000006'),'other owner survives');
end $$;
\echo PASS whole-user deletion including funded/corrected metal, valuation/disposal and refund history
rollback;
