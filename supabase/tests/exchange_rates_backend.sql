begin;

\echo 1..10

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('6f000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fx-owner@example.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('6f000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fx-other@example.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.exchange_rates (
  user_id, provider, base_currency_code, quote_currency_code, rate,
  effective_at, source, fetched_at
)
values
  (null, 'frankfurter', 'USD', 'SAR', 3.750000000000, '2026-09-16T00:00:00Z', 'frankfurter', '2026-09-16T01:00:00Z'),
  (null, 'frankfurter', 'EUR', 'SAR', 4.331100000000, '2026-09-16T00:00:00Z', 'frankfurter', '2026-09-16T01:00:00Z');

select pg_catalog.set_config('request.jwt.claim.sub', '6f000000-0000-4000-8000-000000000001', true);
set local role authenticated;

do $test$
declare resolved record;
begin
  select * into resolved from public.resolve_historical_exchange_rate('USD', 'SAR', '2026-09-16T12:00:00Z');
  if resolved.rate <> 3.75 or resolved.direction <> 'direct' or resolved.source <> 'frankfurter' then
    raise exception 'USD/SAR provider direct failed';
  end if;
end;
$test$;
\echo ok 1 - USD/SAR provider direct

do $test$
declare resolved record;
begin
  select * into resolved from public.resolve_historical_exchange_rate('EUR', 'SAR', '2026-09-16T12:00:00Z');
  if resolved.rate <> 4.3311 or resolved.direction <> 'direct' then raise exception 'EUR/SAR provider direct failed'; end if;
end;
$test$;
\echo ok 2 - EUR/SAR provider direct

do $test$
declare resolved record;
begin
  select * into resolved from public.resolve_historical_exchange_rate('SAR', 'USD', '2026-09-16T12:00:00Z');
  if resolved.rate <> (1::numeric / 3.75) or resolved.direction <> 'inverse' then raise exception 'SAR/USD provider inverse failed'; end if;
end;
$test$;
\echo ok 3 - SAR/USD provider inverse

do $test$
begin
  begin
    perform * from public.resolve_historical_exchange_rate('SAR', 'SAR', now());
    raise exception 'identity request unexpectedly reached stored resolver';
  exception when sqlstate '22023' then null;
  end;
end;
$test$;
\echo ok 4 - SAR/SAR identity remains backend-owned

insert into public.exchange_rates (
  user_id, base_currency_code, quote_currency_code, rate, effective_at, source
)
values
  ('6f000000-0000-4000-8000-000000000001', 'GBP', 'SAR', 4.90, '2026-09-15T00:00:00Z', 'manual'),
  ('6f000000-0000-4000-8000-000000000001', 'SAR', 'EGP', 13.25, '2026-09-15T00:00:00Z', 'manual');

do $test$
declare resolved record;
begin
  select * into resolved from public.resolve_historical_exchange_rate('GBP', 'SAR', '2026-09-16T12:00:00Z');
  if resolved.rate <> 4.90 or resolved.direction <> 'direct' or resolved.source <> 'manual' then raise exception 'manual direct failed'; end if;
end;
$test$;
\echo ok 5 - manual direct fallback

do $test$
declare resolved record;
begin
  select * into resolved from public.resolve_historical_exchange_rate('EGP', 'SAR', '2026-09-16T12:00:00Z');
  if resolved.rate <> (1::numeric / 13.25) or resolved.direction <> 'inverse' or resolved.source <> 'manual' then raise exception 'manual inverse failed'; end if;
end;
$test$;
\echo ok 6 - manual inverse fallback

do $test$
declare resolved_count integer;
begin
  select count(*) into resolved_count from public.resolve_historical_exchange_rate('GBP', 'EGP', '2026-09-16T12:00:00Z');
  if resolved_count <> 0 then raise exception 'missing rate was not unavailable'; end if;
end;
$test$;
\echo ok 7 - no fallback returns no row

do $test$
begin
  begin
    insert into public.exchange_rates (user_id, base_currency_code, quote_currency_code, rate, effective_at, source)
    values ('6f000000-0000-4000-8000-000000000001', 'USD', 'EGP', 0, now(), 'manual');
    raise exception 'zero rate was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.exchange_rates (user_id, base_currency_code, quote_currency_code, rate, effective_at, source)
    values ('6f000000-0000-4000-8000-000000000001', 'USD', 'EGP', -1, now(), 'manual');
    raise exception 'negative rate was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.exchange_rates (user_id, base_currency_code, quote_currency_code, rate, effective_at, source)
    values ('6f000000-0000-4000-8000-000000000001', 'USD', 'EGP', 'NaN'::numeric, now(), 'manual');
    raise exception 'NaN rate was accepted';
  exception when check_violation then null;
  end;
end;
$test$;
\echo ok 8 - invalid rates are rejected instead of becoming zero

reset role;
insert into public.exchange_rates (user_id, base_currency_code, quote_currency_code, rate, effective_at, source)
values ('6f000000-0000-4000-8000-000000000002', 'GBP', 'EGP', 60, '2026-09-15T00:00:00Z', 'manual');
set local role authenticated;

do $test$
declare visible_count integer; resolved_count integer;
begin
  select count(*) into visible_count from public.exchange_rates where user_id = '6f000000-0000-4000-8000-000000000002';
  select count(*) into resolved_count from public.resolve_historical_exchange_rate('GBP', 'EGP', '2026-09-16T12:00:00Z');
  if visible_count <> 0 or resolved_count <> 0 then raise exception 'cross-user manual rate was visible'; end if;
end;
$test$;
\echo ok 9 - manual rows are isolated by authenticated user

update public.exchange_rates
set rate = 1
where provider = 'frankfurter'
  and base_currency_code = 'USD'
  and quote_currency_code = 'SAR';
reset role;
do $test$
declare after_rate numeric;
begin
  select rate into after_rate from public.exchange_rates where provider = 'frankfurter' and base_currency_code = 'USD' and quote_currency_code = 'SAR';
  if after_rate <> 3.75 then raise exception 'provider row was changed'; end if;
end;
$test$;
set local role authenticated;
\echo ok 10 - provider cache rows cannot be changed by authenticated users

rollback;
