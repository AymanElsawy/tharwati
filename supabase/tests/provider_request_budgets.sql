begin;
\echo 1..6
-- Historical S2-A regression fixture, not deployment policy.
select public.configure_provider_capacity('twelve_data',240,4000,10000,100000,true);
select public.configure_provider_capacity('asset_search',40,400,null,null,true);
select public.configure_provider_capacity('frankfurter',120,2000,10000,100000,true);
delete from provider_private.global_budgets;
insert into auth.users(id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('18000000-0000-4000-8000-000000000001', 's2-sql@example.invalid', '{}', '{}', now(), now());

do $$ begin
  if has_schema_privilege('authenticated', 'provider_private', 'USAGE')
    or has_table_privilege('authenticated', 'provider_private.budgets', 'SELECT')
    or has_function_privilege('authenticated', 'public.write_asset_search_cache(text,jsonb)', 'EXECUTE')
    or has_function_privilege('anon', 'public.reserve_provider_budget(text,text,integer)', 'EXECUTE') then
    raise exception 'internal provider state exposed';
  end if;
end $$;
\echo ok 1 - internal state and cache writes inaccessible to normal clients
select set_config('request.jwt.claim.sub', '18000000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$ declare v jsonb; begin
  for i in 1..40 loop
    v := public.reserve_provider_budget('twelve_data','search',1);
    if v->>'allowed' <> 'true' then raise exception 'legitimate search rejected'; end if;
  end loop;
  if public.reserve_provider_budget('twelve_data','search',1)->>'code' <> 'provider_refresh_rate_limited' then raise exception 'search abuse accepted'; end if;
end $$;
\echo ok 2 - forty unique provider searches allowed and forty-first blocked
do $$ begin
  if public.reserve_provider_budget('frankfurter','fx',1)->>'allowed' <> 'true' then raise exception 'independent provider blocked'; end if;
  begin
    perform public.reserve_provider_budget('frankfurter','fx',0);
    raise exception 'zero cost accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.reserve_provider_budget(null,'fx',1);
    raise exception 'null provider accepted';
  exception when invalid_parameter_value then null; end;
end $$;
\echo ok 3 - independent provider and invalid cost/provider checks
reset role;
do $$ begin
  if (select minute_used from provider_private.budgets where user_id='18000000-0000-4000-8000-000000000001' and bucket='twelve_data') <> 40 then raise exception 'denial partially charged provider'; end if;
end $$;
\echo ok 4 - rejection does not partially charge another bucket
select public.write_asset_search_cache('expired-s2', '[]');
update provider_private.asset_search_cache set expires_at = now() - interval '1 second' where cache_key='expired-s2';
update provider_private.budgets set updated_at=now()-interval '3 days' where user_id='18000000-0000-4000-8000-000000000001';
select public.prune_provider_state();
do $$ begin
  if exists(select 1 from provider_private.asset_search_cache where cache_key='expired-s2')
    or exists(select 1 from provider_private.budgets where user_id='18000000-0000-4000-8000-000000000001') then raise exception 'expiry did not clean'; end if;
end $$;
\echo ok 5 - protected bounded cleanup removes expired records
do $$ begin
  for i in 1..2050 loop perform public.write_asset_search_cache('s2-cap-'||i, '[]'); end loop;
  if (select count(*) from provider_private.asset_search_cache) > 2048 then raise exception 'cache grew without bound'; end if;
end $$;
\echo ok 6 - durable search cache retains at most 2048 records
rollback;
