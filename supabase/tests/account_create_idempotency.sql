\o /dev/null
begin;
-- Synthetic fixtures for disposable Slice 3 tests only.
do $test$ begin
 if private.slice3_valuation_method(U&'\00A0other: \2000value 100A\3000') is distinct from 'other:value 100A'
 or private.slice3_valuation_method('other:value 100A') = private.slice3_valuation_method('other:value 100')
 then raise exception 'method canonicalization must trim Unicode whitespace without losing content'; end if;
end $test$;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('71000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','slice3-1@example.invalid','','{}','{}',now(),now()),
('71000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','slice3-2@example.invalid','','{}','{}',now(),now());
insert into public.financial_accounts(id,user_id,account_type_code,name,currency_code,opening_balance,metal_type,investment_type,initial_ownership_percentage,ownership_percentage,property_type) values
('72000000-0000-4000-8001-000000000001','71000000-0000-4000-8000-000000000001','cash','Funding','USD',1000,null,null,null,null,null),
('72000000-0000-4000-8001-000000000002','71000000-0000-4000-8000-000000000001','gold','Gold','USD',0,'gold',null,null,null,null),
('72000000-0000-4000-8001-000000000003','71000000-0000-4000-8000-000000000001','brokerage','Brokerage','USD',1000,null,'stock_etf',null,null,null),
('72000000-0000-4000-8001-000000000004','71000000-0000-4000-8000-000000000001','real_estate','Property','USD',0,null,null,100,100,'villa');
insert into public.assets(id,user_id,asset_type_code,symbol,name,currency_code,exchange,is_custom,is_active,canonical_quantity_unit) values ('73000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','stock','S31','Slice 3 Asset','USD','XTEST',true,true,'shares');
insert into public.financial_accounts(id,user_id,account_type_code,name,currency_code,opening_balance,metal_type,investment_type,initial_ownership_percentage,ownership_percentage,property_type) values
('72000000-0000-4000-8002-000000000001','71000000-0000-4000-8000-000000000002','cash','Funding','USD',1000,null,null,null,null,null),
('72000000-0000-4000-8002-000000000002','71000000-0000-4000-8000-000000000002','gold','Gold','USD',0,'gold',null,null,null,null),
('72000000-0000-4000-8002-000000000003','71000000-0000-4000-8000-000000000002','brokerage','Brokerage','USD',1000,null,'stock_etf',null,null,null),
('72000000-0000-4000-8002-000000000004','71000000-0000-4000-8000-000000000002','real_estate','Property','USD',0,null,null,100,100,'villa');
insert into public.assets(id,user_id,asset_type_code,symbol,name,currency_code,exchange,is_custom,is_active,canonical_quantity_unit) values ('73000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000002','stock','S32','Slice 3 Asset','USD','XTEST',true,true,'shares');

create temporary table slice3_cases(operation text, statement text, result jsonb);
insert into slice3_cases(operation,statement) values
('metal',$call$select public.add_metal_purchase_v2('72000000-0000-4000-8001-000000000002','24k','2026-09-01T10:00:00Z',2,10,'cash_account','72000000-0000-4000-8001-000000000001',1,'74000000-0000-4000-8000-000000000001','original')$call$),
('holding',$call$select public.add_existing_holding_v2('72000000-0000-4000-8001-000000000003','73000000-0000-4000-8000-000000000001',2,10,'74000000-0000-4000-8000-000000000001','2026-09-01T10:00:00Z','original',null)$call$),
('valuation',$call$select public.add_account_valuation_v2('72000000-0000-4000-8001-000000000004',500,'2026-09-01','74000000-0000-4000-8000-000000000001','owner_estimate','original')$call$),
('ordinary',$call$select public.create_financial_account_v2('bank','Slice3 bank','USD','74000000-0000-4000-8000-000000000001',50,'original','credit',100,15,null,null)$call$),
('valued',$call$select public.create_valued_account_v2('business','Slice3 business','USD',null,'company','technology',50,null,'original',1000,'2026-09-01','owner_estimate',null,'74000000-0000-4000-8000-000000000001')$call$);
grant all on slice3_cases to authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $test$
declare c record; first_result jsonb; replay_result jsonb;
begin
 for c in select * from slice3_cases loop
   execute c.statement into first_result;
   execute replace(replace(replace(c.statement,'''original''',''' original '''),'2026-09-01T10:00:00Z','2026-09-01T13:00:00+03:00'),',2,10,',',2.00,10.0,') into replay_result;
   if first_result->>'replayed'<>'false' or replay_result->>'replayed'<>'true' or first_result-'replayed' is distinct from replay_result-'replayed' then raise exception 'replay mismatch: %',c.operation; end if;
   update slice3_cases set result=first_result where operation=c.operation;
   begin
     execute replace(c.statement,'''original''','''changed''');
     raise exception 'changed payload accepted: %',c.operation;
   exception when invalid_parameter_value then null; end;
 end loop;
end $test$;
reset role;
do $test$ begin
 if (select count(*) from private.account_record_mutation_receipts where user_id='71000000-0000-4000-8000-000000000001')<>5 then raise exception 'receipt count'; end if;
 if (select count(*) from public.metal_purchases where user_id='71000000-0000-4000-8000-000000000001')<>1 then raise exception 'duplicate metal purchase'; end if;
 if not exists(select 1 from public.financial_accounts where id='72000000-0000-4000-8001-000000000002' and balance_grams=2 and cost_per_unit=10.5) then raise exception 'metal projection'; end if;
 if not exists(select 1 from public.get_account_balances(array['72000000-0000-4000-8001-000000000001'::uuid]) where current_balance::numeric=979) then raise exception 'funding debit'; end if;
 if not exists(select 1 from public.holdings where account_id='72000000-0000-4000-8001-000000000003' and quantity=2 and total_cost_basis=20) then raise exception 'duplicate quantity/basis'; end if;
 if not exists(select 1 from public.get_account_balances(array['72000000-0000-4000-8001-000000000003'::uuid]) where current_balance::numeric=1000) then raise exception 'holding moved cash'; end if;
 if (select count(*) from public.account_valuations where user_id='71000000-0000-4000-8000-000000000001')<>2 then raise exception 'valuation duplicate'; end if;
 if (select count(*) from public.financial_accounts where user_id='71000000-0000-4000-8000-000000000001')<>6 then raise exception 'account duplicate'; end if;
 if exists(select 1 from slice3_cases where operation in ('ordinary','valued') and jsonb_typeof(result->'opening_balance')<>'string') then raise exception 'account decimal result'; end if;
end $test$;
\echo PASS all five exact replay, changed payload, cash/quantity/basis/history and decimal results

select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select public.add_metal_purchase_v2('72000000-0000-4000-8002-000000000002','24k','2026-09-01T10:00:00Z',2,10,'cash_account','72000000-0000-4000-8002-000000000001',1,'74000000-0000-4000-8000-000000000001','original');
select public.add_existing_holding_v2('72000000-0000-4000-8002-000000000003','73000000-0000-4000-8000-000000000002',2,10,'74000000-0000-4000-8000-000000000001','2026-09-01T10:00:00Z','original',null);
select public.add_account_valuation_v2('72000000-0000-4000-8002-000000000004',500,'2026-09-01','74000000-0000-4000-8000-000000000001','owner_estimate','original');
select public.create_financial_account_v2('bank','Slice3 bank','USD','74000000-0000-4000-8000-000000000001',50,'original','credit',100,15,null,null);
select public.create_valued_account_v2('business','Slice3 business','USD',null,'company','technology',50,null,'original',1000,'2026-09-01','owner_estimate',null,'74000000-0000-4000-8000-000000000001');
reset role;
do $test$ begin
 if (select count(*) from private.account_record_mutation_receipts where idempotency_key='74000000-0000-4000-8000-000000000001')<>10 then raise exception 'user/operation isolation'; end if;
end $test$;
\echo PASS same UUID isolated by user and operation

select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $test$ declare c record; before_count integer; begin
 for c in select * from slice3_cases loop
   begin
     execute replace(replace(replace(c.statement,'74000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000002'),'Slice3 bank','Slice3 rollback bank'),'Slice3 business','Slice3 rollback business');
     raise exception 'force rollback' using errcode='ZX001';
   exception when sqlstate 'ZX001' then null; end;
 end loop;
 begin
   perform public.add_metal_purchase_v2('72000000-0000-4000-8001-000000000002','24k','2026-09-01',9999,9999,'cash_account','72000000-0000-4000-8001-000000000001',0,'74000000-0000-4000-8000-000000000003',null);
   raise exception 'insufficient funds accepted';
 exception when no_data_found then null; end;
 begin
   perform public.add_account_valuation_v2('72000000-0000-4000-8002-000000000004',1,'2026-09-01','74000000-0000-4000-8000-000000000004');
   raise exception 'foreign account accepted';
 exception when check_violation then null; end;
end $test$;
reset role;
do $test$ begin
 if exists(select 1 from private.account_record_mutation_receipts where idempotency_key in ('74000000-0000-4000-8000-000000000002','74000000-0000-4000-8000-000000000003','74000000-0000-4000-8000-000000000004')) then raise exception 'rollback left receipt'; end if;
 if (select count(*) from public.metal_purchases where user_id='71000000-0000-4000-8000-000000000001')<>1 or (select count(*) from public.account_valuations where user_id='71000000-0000-4000-8000-000000000001')<>2 or (select count(*) from public.financial_accounts where user_id='71000000-0000-4000-8000-000000000001')<>6 then raise exception 'rollback left business effect'; end if;
end $test$;
\echo PASS all five rollback, metal insufficient funds, account ownership

-- Replays must succeed even after mutable business state invalidates new submissions.
select public.add_account_disposal('72000000-0000-4000-8001-000000000004','2026-09-02',0,'USD',100,'74000000-0000-4000-8000-000000000005',null,null);
set local role authenticated;
select public.add_account_valuation_v2('72000000-0000-4000-8001-000000000004',500,'2026-09-01','74000000-0000-4000-8000-000000000001','owner_estimate','original');
reset role;
\echo PASS replay before active-account validation
-- Preserve subtype constraints, opening balances and initial valuation semantics.
set local role authenticated;
do $test$
declare r jsonb; replay jsonb; c record;
begin
 r := public.create_financial_account_v2('cash','Slice3 cash','USD',gen_random_uuid(),12.34);
 if r->>'opening_balance'<>'12.34' then raise exception 'cash opening balance'; end if;
 r := public.create_financial_account_v2('bank','Slice3 debit','USD',gen_random_uuid(),12.34,null,'debit');
 if r->>'bank_subtype'<>'debit' then raise exception 'bank subtype'; end if;
 r := public.create_financial_account_v2('brokerage','Slice3 broker','SAR',gen_random_uuid(),100,null,null,null,null,'stock_etf');
 if r->>'opening_balance'<>'100.00' then raise exception 'brokerage opening cash'; end if;
 r := public.create_financial_account_v2('gold','Silver','USD',gen_random_uuid(),0,null,null,null,null,null,'silver');
 if r->>'opening_balance'<>'0.00' or r->>'metal_type'<>'silver' then raise exception 'metal container'; end if;
 r := public.create_financial_account_v2('other','Slice3 other','USD',gen_random_uuid(),0);
 if r->>'account_type_code'<>'other' then raise exception 'other type'; end if;
 r := public.create_valued_account_v2('real_estate','Slice3 home','AED','villa','ignored','ignored',75,'location',null,500,'2026-09-01','other:  appraisal  ',null,'74000000-0000-4000-8000-000000000020');
 replay := public.create_valued_account_v2('real_estate',' Slice3 home ','AED','villa','different ignored','different ignored',75.00,' location ',null,500.0,'2026-09-01','other:appraisal',null,'74000000-0000-4000-8000-000000000020');
 if r-'replayed' is distinct from replay-'replayed' or replay->>'replayed'<>'true' or r->>'opening_balance'<>'0.00' or r->>'initial_ownership_percentage'<>'75.00' then raise exception 'property create replay'; end if;
 if not exists(select 1 from public.account_valuations where account_id=(r->>'id')::uuid and valuation_amount=500 and valuation_method='other:appraisal') then raise exception 'property initial valuation'; end if;
 begin
   perform public.create_financial_account_v2('bank','Invalid credit','USD',gen_random_uuid(),101,null,'credit',100);
   raise exception 'invalid available credit accepted';
 exception when check_violation then null; end;
 begin
   perform public.create_financial_account_v2('real_estate','Bypass valued create','USD',gen_random_uuid());
   raise exception 'valued bypass accepted';
 exception when invalid_parameter_value then null; end;
 for c in select * from slice3_cases loop
   begin
     execute replace(c.statement,'''74000000-0000-4000-8000-000000000001''','null');
     raise exception 'null key accepted: %',c.operation;
   exception when invalid_parameter_value then null; end;
 end loop;
end $test$;
reset role;
\echo PASS account subtypes, balances, Real Estate initial valuation, effective fields and required keys

insert into public.assets(id,user_id,asset_type_code,symbol,name,currency_code,exchange,is_custom,is_active,canonical_quantity_unit)
values('73000000-0000-4000-8000-000000000003','71000000-0000-4000-8000-000000000001','stock','CROSS','Cross','SAR','XTEST',true,true,'shares');
set local role authenticated;
do $test$ declare first_result jsonb; replay jsonb; begin
 first_result:=public.add_existing_holding_v2('72000000-0000-4000-8001-000000000003','73000000-0000-4000-8000-000000000003',2,10,'74000000-0000-4000-8000-000000000021','2026-09-01',null,3.75);
 replay:=public.add_existing_holding_v2('72000000-0000-4000-8001-000000000003','73000000-0000-4000-8000-000000000003',2.0,10.00,'74000000-0000-4000-8000-000000000021','2026-09-01',null,3.750);
 if first_result-'replayed' is distinct from replay-'replayed' then raise exception 'historical FX replay'; end if;
 if not exists(select 1 from public.holdings where account_id='72000000-0000-4000-8001-000000000003' and asset_id='73000000-0000-4000-8000-000000000003' and quantity=2 and total_cost_basis=75) then raise exception 'historical FX basis'; end if;
 begin
   perform public.add_existing_holding_v2('72000000-0000-4000-8001-000000000003','73000000-0000-4000-8000-000000000003',2,10,gen_random_uuid(),'2026-09-01',null,null);
   raise exception 'missing historical FX accepted';
 exception when invalid_parameter_value then null; end;
 begin
   perform public.add_existing_holding_v2('72000000-0000-4000-8001-000000000003','73000000-0000-4000-8000-000000000002',2,10,gen_random_uuid(),'2026-09-01',null,null);
   raise exception 'foreign asset accepted';
 exception when no_data_found then null; end;
 begin
   update public.financial_accounts set currency_code='SAR' where id='72000000-0000-4000-8001-000000000004';
   raise exception 'valued account currency changed after history';
 exception when check_violation then null; end;
 begin
   update public.financial_accounts set opening_balance=2000 where id='72000000-0000-4000-8001-000000000004';
   raise exception 'valued account opening balance changed after history';
 exception when check_violation then null; end;
 begin
   perform public.create_financial_account_v2('bank','Slice3 bank','USD',gen_random_uuid(),50,'original','credit',100);
   raise exception 'duplicate active account accepted';
 exception when unique_violation then null; end;
end $test$;
reset role;
do $test$ begin
 if has_table_privilege('authenticated','private.account_record_mutation_receipts','SELECT')
 or has_function_privilege('authenticated','private.slice3_account_result(public.financial_accounts)','EXECUTE')
 or has_function_privilege('anon','public.add_account_valuation_v2(uuid,numeric,date,uuid,text,text)','EXECUTE')
 then raise exception 'private receipt or anonymous RPC access'; end if;
end $test$;
\echo PASS historical FX, ownership, immutability, uniqueness and private access
rollback;
