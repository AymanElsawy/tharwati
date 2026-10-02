begin;
\echo 1..6
delete from metal_private.spot_quotes;
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('20000000-0000-4000-8000-000000000001','metal-sql@example.invalid','{}','{}',now(),now());
do $$ begin
  if has_schema_privilege('authenticated','metal_private','usage')
    or has_table_privilege('authenticated','metal_private.spot_quotes','select')
    or has_function_privilege('authenticated','public.store_metal_spot_quote(text,text,timestamptz,timestamptz,text)','execute')
    or has_function_privilege('anon','public.read_metal_spot_quote(text)','execute') then
    raise exception 'private metal cache exposed'; end if;
end $$;
\echo ok 1 - cache private, authenticated read only, server-owned writes
select public.store_metal_spot_quote('XAU','4340.123456789012345678','2026-09-01Z','2026-09-01T00:01:00Z','provider');
select public.store_metal_spot_quote('XAG','30.123456789012345678','2026-09-01Z','2026-09-01T00:01:00Z','provider');
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare v jsonb; begin
  v:=public.read_metal_spot_quote('XAU');
  if v->>'price'<>'4340.123456789012345678' or (v->>'effectiveAt')::timestamptz<>'2026-09-01Z'::timestamptz
    or (v->>'fetchedAt')::timestamptz<>'2026-09-01T00:01:00Z'::timestamptz then
    raise exception 'decimal/timestamps degraded'; end if;
  if public.read_metal_spot_quote('XAG')->>'price'<>'30.123456789012345678' then raise exception 'metal identity mixed'; end if;
end $$;
\echo ok 2 - authenticated exact decimal and timestamp roundtrip, distinct metal identities
reset role;
select public.store_metal_spot_quote('XAU','1','2026-08-01Z','2026-09-02Z','observed');
do $$ begin
  if public.read_metal_spot_quote('XAU')->>'price'<>'4340.123456789012345678' then raise exception 'older refresh overwrote last known'; end if;
end $$;
\echo ok 3 - out-of-order refresh cannot erase latest valid value
do $$ begin
  begin perform public.store_metal_spot_quote('XAU','0',now(),now(),'observed'); raise exception 'zero accepted';
  exception when invalid_parameter_value then null; end;
  begin perform public.store_metal_spot_quote('XAU','NaN',now(),now(),'observed'); raise exception 'NaN accepted';
  exception when invalid_parameter_value then null; end;
  begin perform public.store_metal_spot_quote('XAU','5',now(),now()+interval '1 hour','observed'); raise exception 'future accepted';
  exception when invalid_parameter_value then null; end;
  begin update metal_private.spot_quotes set fetched_at=now()+interval '1 hour'; raise exception 'future direct write accepted';
  exception when check_violation then null; end;
end $$;
\echo ok 4 - zero, invalid and future timestamps rejected without erasing stored values
delete from metal_private.spot_quotes where symbol='XAG';
do $$ begin
  if public.read_metal_spot_quote('XAG') is not null then raise exception 'missing quote fabricated'; end if;
  if (select count(*) from metal_private.spot_quotes)>2 then raise exception 'cache growth unbounded'; end if;
end $$;
\echo ok 5 - missing quote null and fixed two-row cache
do $$ begin
  if position('market_prices' in pg_get_functiondef('public.read_metal_spot_quote(text)'::regprocedure))>0
    or position('market_prices' in pg_get_functiondef('public.store_metal_spot_quote(text,text,timestamptz,timestamptz,text)'::regprocedure))>0 then
    raise exception 'securities architecture reused'; end if;
end $$;
\echo ok 6 - no securities price dependency
rollback;
