begin;
insert into auth.users(id) values ('19000000-0000-4000-8000-000000000011');

do $$ begin
  if has_function_privilege('anon','public.reserve_twelve_data_symbols(integer)','EXECUTE')
    or has_function_privilege('service_role','public.reserve_twelve_data_symbols(integer)','EXECUTE')
    or not has_function_privilege('authenticated','public.reserve_twelve_data_symbols(integer)','EXECUTE')
    or has_table_privilege('authenticated','provider_private.capacity','SELECT') then
    raise exception 'reservation/config authorization failed';
  end if;
end $$;
set local role authenticated;
do $$ begin
  begin perform public.reserve_twelve_data_symbols(1); raise exception 'missing identity accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000011',true);
set local role authenticated;
do $$ declare r jsonb; begin
  foreach r in array array[public.reserve_twelve_data_symbols(5)] loop
    if r <> '{"grantedSymbolCount":0,"code":"provider_capacity_unconfigured"}'::jsonb then raise exception 'missing config failed open'; end if;
  end loop;
  begin perform public.reserve_twelve_data_symbols(0); raise exception 'invalid request accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.reserve_twelve_data_symbols(51); raise exception 'oversized request accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.reserve_twelve_data_symbols(null); raise exception 'null request accepted'; exception when invalid_parameter_value then null; end;
end $$;
reset role;
select public.configure_provider_capacity('twelve_data',4,10,3,10,true);
select public.configure_provider_capacity('asset_search',2,10,null,null,true);
set local role authenticated;
do $$ begin
  if public.reserve_provider_budget('twelve_data','search',1)->>'allowed'<>'true' then raise exception 'search failed'; end if;
  if public.reserve_twelve_data_symbols(5)<>'{"grantedSymbolCount":2}'::jsonb then raise exception 'partial capacity not shared with search'; end if;
end $$;
reset role;
do $$ begin
  if (select day_used from provider_private.global_budgets where provider='twelve_data')<>3
    or (select day_used from provider_private.budgets where user_id='19000000-0000-4000-8000-000000000011' and bucket='twelve_data')<>3
    or (select day_used from provider_private.budgets where user_id='19000000-0000-4000-8000-000000000011' and bucket='asset_search')<>1 then raise exception 'double/missing charge'; end if;
end $$;
set local role authenticated;
do $$ declare r jsonb; begin
  r:=public.reserve_twelve_data_symbols(2);
  if r->>'grantedSymbolCount'<>'0' or r->>'code'<>'provider_refresh_rate_limited'
    or (r->>'retryAfterSeconds')::integer not between 1 and 60
    or r- 'grantedSymbolCount'-'code'-'retryAfterSeconds'<>'{}'::jsonb then raise exception 'unsafe exhaustion response'; end if;
end $$;
reset role;
select public.configure_provider_capacity('twelve_data',4,10,7,10,true);
set local role authenticated;
do $$ begin
  if public.reserve_twelve_data_symbols(5)<>'{"grantedSymbolCount":1}'::jsonb then raise exception 'user remaining capacity ignored'; end if;
end $$;
reset role;
select public.configure_provider_capacity('twelve_data',20,5,30,20,true);
set local role authenticated;
do $$ begin
  if public.reserve_twelve_data_symbols(5)<>'{"grantedSymbolCount":1}'::jsonb then raise exception 'user day limit ignored'; end if;
end $$;
reset role;
select public.configure_provider_capacity('twelve_data',20,20,30,5,true);
set local role authenticated;
do $$ declare r jsonb; begin
  r:=public.reserve_twelve_data_symbols(1);
  if r->>'code'<>'provider_refresh_rate_limited' or (r->>'retryAfterSeconds')::integer not between 1 and 86400 then raise exception 'global day limit ignored'; end if;
end $$;
reset role;
select public.configure_provider_capacity('twelve_data',100,100,100,100,false);
set local role authenticated;
do $$ begin
  if public.reserve_twelve_data_symbols(1)<>'{"grantedSymbolCount":0,"code":"provider_refresh_paused"}'::jsonb then raise exception 'paused config ignored'; end if;
end $$;
reset role;
-- Previous-window consumption must not reduce the new window's grant.
update provider_private.budgets set minute_at=date_trunc('minute',clock_timestamp())-interval '1 minute',day_at='2000-01-01' where bucket='twelve_data';
update provider_private.global_budgets set minute_at=date_trunc('minute',clock_timestamp())-interval '1 minute',day_at='2000-01-01';
select public.configure_provider_capacity('twelve_data',60,120,80,120,true);
set local role authenticated;
do $$ begin
  if public.reserve_twelve_data_symbols(50)<>'{"grantedSymbolCount":50}'::jsonb then raise exception 'variable capacity/window reset failed'; end if;
end $$;
reset role;
select public.configure_provider_capacity('gold_api',1,1,1,1,true);
set local role authenticated;
do $$ begin
  if public.reserve_provider_budget('gold_api','metal',1)->>'allowed'<>'true' then raise exception 'Gold accounting changed'; end if;
end $$;
reset role;
do $$ begin
  if (select day_used from provider_private.global_budgets where provider='twelve_data')<>50 then raise exception 'Gold charged securities'; end if;
end $$;
rollback;
