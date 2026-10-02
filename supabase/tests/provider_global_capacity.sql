begin;
\echo 1..8
delete from provider_private.capacity;
delete from provider_private.global_budgets;
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('19000000-0000-4000-8000-000000000001','s2b-sql@example.invalid','{}','{}',now(),now());
select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ begin
  if public.reserve_provider_budget('twelve_data','market',1)->>'code'<>'provider_capacity_unconfigured' then raise exception 'missing config failed open'; end if;
end $$;
\echo ok 1 - missing capacity fails closed
reset role;
do $$ begin
  if has_table_privilege('authenticated','provider_private.capacity','SELECT')
    or has_table_privilege('authenticated','provider_private.global_budgets','SELECT')
    or has_function_privilege('authenticated','public.configure_provider_capacity(text,bigint,bigint,bigint,bigint,boolean)','EXECUTE') then raise exception 'operational config exposed'; end if;
end $$;
\echo ok 2 - config and aggregate state inaccessible to normal clients
select public.configure_provider_capacity('twelve_data',2,2,3,3,true);
set local role authenticated;
do $$ begin
  if public.reserve_provider_budget('twelve_data','market',3)->>'allowed'<>'false' then raise exception 'oversized first reservation allowed'; end if;
end $$;
reset role;
do $$ begin if exists(select 1 from provider_private.global_budgets) then raise exception 'denial charged global'; end if; end $$;
\echo ok 3 - first oversized reservation denied with no partial charges
select public.configure_provider_capacity('twelve_data',4,4,3,3,true);
set local role authenticated;
do $$ begin
  if public.reserve_provider_budget('twelve_data','market',3)->>'allowed'<>'true' then raise exception 'config increase ignored'; end if;
  if public.reserve_provider_budget('twelve_data','market',1)->>'scope'<>'global' then raise exception 'global allowance ignored'; end if;
end $$;
\echo ok 4 - live config increase and aggregate exhaustion honored
reset role;
select public.configure_provider_capacity('twelve_data',4,4,4,4,true);
set local role authenticated;
do $$ begin if public.reserve_provider_budget('twelve_data','market',1)->>'allowed'<>'true' then raise exception 'global capacity update ignored'; end if; end $$;
reset role;
do $$ begin if (select day_used from provider_private.global_budgets where provider='twelve_data')<>4 then raise exception 'configuration reset counters'; end if; end $$;
\echo ok 5 - upgrade preserves accumulated accounting
select public.configure_provider_capacity('gold_api',2,2,3,3,true);
set local role authenticated;
do $$ begin if public.reserve_provider_budget('gold_api','metal',1)->>'allowed'<>'true' then raise exception 'Gold not independent'; end if; end $$;
reset role;
select public.configure_provider_capacity('gold_api',2,2,3,3,false);
set local role authenticated;
do $$ begin if public.reserve_provider_budget('gold_api','metal',1)->>'code'<>'provider_refresh_paused' then raise exception 'circuit breaker ignored'; end if; end $$;
\echo ok 6 - independent Gold capacity and protected circuit breaker
reset role;
update provider_private.budgets set updated_at=now()-interval '3 days' where user_id='19000000-0000-4000-8000-000000000001';
select public.prune_provider_state();
do $$ begin
  if exists(select 1 from provider_private.budgets where user_id='19000000-0000-4000-8000-000000000001')
    or (select count(*) from provider_private.global_budgets)>3 then raise exception 'budget growth not bounded'; end if;
end $$;
\echo ok 7 - inactive users cleaned and global ledger has fixed provider cardinality
do $$ begin
  begin perform public.configure_provider_capacity('frankfurter',0,1,1,1,true); raise exception 'invalid capacity allowed';
  exception when check_violation then null; end;
end $$;
\echo ok 8 - invalid capacity rejected
rollback;
