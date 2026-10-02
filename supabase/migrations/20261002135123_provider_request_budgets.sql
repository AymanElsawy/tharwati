-- S2: caller-owned reservations, fixed server policy, no client-readable ledger.
create schema if not exists provider_private;
revoke all on schema provider_private from public, anon, authenticated;

create table provider_private.budgets (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null check (bucket in ('twelve_data', 'asset_search', 'frankfurter')),
  minute_at timestamptz not null,
  minute_used integer not null check (minute_used >= 0),
  day_at timestamptz not null,
  day_used integer not null check (day_used >= 0),
  updated_at timestamptz not null,
  primary key (user_id, bucket)
);
create index provider_budgets_expiry on provider_private.budgets(updated_at);
alter table provider_private.budgets enable row level security;
revoke all on provider_private.budgets from public, anon, authenticated;

create table provider_private.asset_search_cache (
  cache_key text primary key check (length(cache_key) <= 400),
  results jsonb not null check (jsonb_typeof(results) = 'array' and jsonb_array_length(results) <= 10),
  expires_at timestamptz not null,
  updated_at timestamptz not null
);
create index asset_search_cache_expiry on provider_private.asset_search_cache(expires_at);
alter table provider_private.asset_search_cache enable row level security;
revoke all on provider_private.asset_search_cache from public, anon, authenticated;

-- Policies are code, not caller parameters. Cost = symbol credits (Twelve Data)
-- or individual HTTP attempts (Frankfurter), including failed attempts/retries.
create function public.reserve_provider_budget(p_provider text, p_operation text, p_units integer)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_now timestamptz;
  v_minute timestamptz;
  v_day timestamptz;
  v_bucket text;
  v_buckets text[];
  v_min_limit integer;
  v_day_limit integer;
  v_row provider_private.budgets%rowtype;
  v_retry integer := 0;
begin
  if v_user is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_provider is null or p_operation is null or p_units is null or p_units < 1 or p_units > 50
     or not ((p_provider = 'twelve_data' and p_operation in ('market', 'search'))
          or (p_provider = 'frankfurter' and p_operation = 'fx'))
     or (p_operation in ('search', 'fx') and p_units <> 1) then
    raise exception 'invalid provider reservation' using errcode = '22023';
  end if;
  -- Serialize every bucket of this authenticated user, including first insertion.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('provider-budget:' || v_user::text, 0));
  v_now := clock_timestamp();
  v_minute := date_trunc('minute', v_now);
  v_day := date_trunc('day', v_now at time zone 'UTC') at time zone 'UTC';
  v_buckets := case when p_operation = 'search' then array['twelve_data','asset_search'] else array[p_provider] end;
  foreach v_bucket in array v_buckets loop
    v_min_limit := case v_bucket when 'twelve_data' then 240 when 'asset_search' then 40 else 120 end;
    v_day_limit := case v_bucket when 'twelve_data' then 4000 when 'asset_search' then 400 else 2000 end;
    select * into v_row from provider_private.budgets where user_id = v_user and bucket = v_bucket;
    if found then
      if v_row.minute_at = v_minute and v_row.minute_used + p_units > v_min_limit then
        v_retry := greatest(v_retry, ceil(extract(epoch from v_minute + interval '1 minute' - v_now))::integer);
      end if;
      if v_row.day_at = v_day and v_row.day_used + p_units > v_day_limit then
        v_retry := greatest(v_retry, ceil(extract(epoch from v_day + interval '1 day' - v_now))::integer);
      end if;
    end if;
  end loop;
  if v_retry > 0 then return jsonb_build_object('allowed', false, 'code', 'provider_refresh_rate_limited', 'retryAfterSeconds', v_retry); end if;
  foreach v_bucket in array v_buckets loop
    insert into provider_private.budgets values (v_user, v_bucket, v_minute, p_units, v_day, p_units, v_now)
    on conflict (user_id, bucket) do update set
      minute_used = case when budgets.minute_at = excluded.minute_at then budgets.minute_used + p_units else p_units end,
      day_used = case when budgets.day_at = excluded.day_at then budgets.day_used + p_units else p_units end,
      minute_at = excluded.minute_at, day_at = excluded.day_at, updated_at = excluded.updated_at;
  end loop;
  -- Bounded opportunistic expiry, independent of expensive-provider availability.
  delete from provider_private.budgets where (user_id, bucket) in (
    select user_id, bucket from provider_private.budgets
    where updated_at < v_now - interval '2 days' order by updated_at limit 100 for update skip locked
  );
  return jsonb_build_object('allowed', true);
end;
$$;
revoke all on function public.reserve_provider_budget(text,text,integer) from public, anon, service_role;
grant execute on function public.reserve_provider_budget(text,text,integer) to authenticated;

create function public.read_asset_search_cache(p_cache_key text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  return (select results from provider_private.asset_search_cache where cache_key = p_cache_key and expires_at > clock_timestamp());
end;
$$;
revoke all on function public.read_asset_search_cache(text) from public, anon, service_role;
grant execute on function public.read_asset_search_cache(text) to authenticated;

-- Only a protected Edge admin client can populate the shared search cache.
create function public.write_asset_search_cache(p_cache_key text, p_results jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_now timestamptz;
begin
  if p_cache_key is null or length(p_cache_key) > 400 or p_results is null
      or jsonb_typeof(p_results) <> 'array' or jsonb_array_length(p_results) > 10
      or octet_length(p_results::text) > 65536 then
    raise exception 'invalid search cache value' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('provider-search-cache', 0));
  v_now := clock_timestamp();
  delete from provider_private.asset_search_cache where expires_at <= v_now;
  insert into provider_private.asset_search_cache values (p_cache_key, p_results, v_now + interval '60 seconds', v_now)
    on conflict (cache_key) do update set results = excluded.results, expires_at = excluded.expires_at, updated_at = excluded.updated_at;
  delete from provider_private.asset_search_cache where cache_key in (
    select cache_key from provider_private.asset_search_cache order by updated_at desc, cache_key offset 2048
  );
end;
$$;
revoke all on function public.write_asset_search_cache(text,jsonb) from public, anon, authenticated;
grant execute on function public.write_asset_search_cache(text,jsonb) to service_role;

-- For a scheduled/manual protected maintenance job; bounded work per call.
create function public.prune_provider_state()
returns void language plpgsql security definer set search_path = ''
as $$
begin
  delete from provider_private.budgets where (user_id, bucket) in (
    select user_id, bucket from provider_private.budgets
    where updated_at < clock_timestamp() - interval '2 days' order by updated_at limit 1000 for update skip locked
  );
  delete from provider_private.asset_search_cache where cache_key in (
    select cache_key from provider_private.asset_search_cache
    where expires_at <= clock_timestamp() order by expires_at limit 2048 for update skip locked
  );
end;
$$;
revoke all on function public.prune_provider_state() from public, anon, authenticated;
grant execute on function public.prune_provider_state() to service_role;
