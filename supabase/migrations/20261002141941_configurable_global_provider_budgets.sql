-- S2-B. Intentionally NO capacity defaults: production must configure its plan.
alter table provider_private.budgets drop constraint budgets_bucket_check;
alter table provider_private.budgets add constraint budgets_bucket_check
  check (bucket in ('twelve_data','asset_search','frankfurter','gold_api'));
alter table provider_private.budgets alter column minute_used type bigint,
  alter column day_used type bigint;

create table provider_private.capacity (
  bucket text primary key check (bucket in ('twelve_data','asset_search','frankfurter','gold_api')),
  user_minute bigint not null check (user_minute > 0),
  user_day bigint not null check (user_day > 0),
  global_minute bigint,
  global_day bigint,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  check ((bucket = 'asset_search' and global_minute is null and global_day is null)
    or (bucket <> 'asset_search' and global_minute > 0 and global_day > 0
      and global_minute is not null and global_day is not null))
);
alter table provider_private.capacity enable row level security;
revoke all on provider_private.capacity from public, anon, authenticated;

create table provider_private.global_budgets (
  provider text primary key check (provider in ('twelve_data','frankfurter','gold_api')),
  minute_at timestamptz not null,
  minute_used bigint not null check (minute_used >= 0),
  day_at timestamptz not null,
  day_used bigint not null check (day_used >= 0),
  updated_at timestamptz not null
);
alter table provider_private.global_budgets enable row level security;
revoke all on provider_private.global_budgets from public, anon, authenticated;

create function public.configure_provider_capacity(
  p_bucket text, p_user_minute bigint, p_user_day bigint,
  p_global_minute bigint, p_global_day bigint, p_enabled boolean default true
)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  -- Same provider-first lock as reservations: config edits never reset usage.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('provider-global:' ||
    case when p_bucket='asset_search' then 'twelve_data' else p_bucket end, 0));
  insert into provider_private.capacity(bucket,user_minute,user_day,global_minute,global_day,enabled)
    values(p_bucket,p_user_minute,p_user_day,p_global_minute,p_global_day,p_enabled)
    on conflict(bucket) do update set user_minute=excluded.user_minute,user_day=excluded.user_day,
      global_minute=excluded.global_minute,global_day=excluded.global_day,
      enabled=excluded.enabled,updated_at=clock_timestamp();
end;
$$;
revoke all on function public.configure_provider_capacity(text,bigint,bigint,bigint,bigint,boolean) from public, anon, authenticated;
grant execute on function public.configure_provider_capacity(text,bigint,bigint,bigint,bigint,boolean) to service_role;

create or replace function public.reserve_provider_budget(p_provider text, p_operation text, p_units integer)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_provider text := case p_operation when 'market' then 'twelve_data' when 'search' then 'twelve_data'
    when 'fx' then 'frankfurter' when 'metal' then 'gold_api' end;
  v_now timestamptz; v_minute timestamptz; v_day timestamptz;
  v_bucket text; v_buckets text[];
  v_policy provider_private.capacity%rowtype;
  v_row provider_private.budgets%rowtype;
  v_global provider_private.global_budgets%rowtype;
  v_min_used bigint; v_day_used bigint;
  v_retry integer := 0; v_scope text;
begin
  if v_user is null then raise exception 'authentication required' using errcode='42501'; end if;
  if v_provider is null or p_provider is null or p_provider <> v_provider
    or p_units is null or p_units < 1 or p_units > 50
    or (p_operation <> 'market' and p_units <> 1) then
    raise exception 'invalid provider reservation' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('provider-global:' || v_provider, 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('provider-budget:' || v_user::text, 0));
  v_now:=clock_timestamp(); v_minute:=date_trunc('minute',v_now);
  v_day:=date_trunc('day',v_now at time zone 'UTC') at time zone 'UTC';
  v_buckets:=case when p_operation='search' then array['twelve_data','asset_search'] else array[v_provider] end;

  -- Every required policy must exist and be enabled, before any counter changes.
  foreach v_bucket in array v_buckets loop
    select * into v_policy from provider_private.capacity where bucket=v_bucket;
    if not found then return jsonb_build_object('allowed',false,'code','provider_capacity_unconfigured'); end if;
    if not v_policy.enabled then return jsonb_build_object('allowed',false,'code','provider_refresh_paused'); end if;
    select * into v_row from provider_private.budgets where user_id=v_user and bucket=v_bucket;
    v_min_used:=case when v_row.minute_at=v_minute then v_row.minute_used else 0 end;
    v_day_used:=case when v_row.day_at=v_day then v_row.day_used else 0 end;
    -- Subtraction prevents bigint overflow at the configured maximum.
    if p_units > v_policy.user_minute-v_min_used then
      v_retry:=greatest(v_retry,ceil(extract(epoch from v_minute+interval '1 minute'-v_now))::integer); v_scope:='user';
    end if;
    if p_units > v_policy.user_day-v_day_used then
      v_retry:=greatest(v_retry,ceil(extract(epoch from v_day+interval '1 day'-v_now))::integer); v_scope:='user';
    end if;
  end loop;
  select * into v_policy from provider_private.capacity where bucket=v_provider;
  select * into v_global from provider_private.global_budgets where provider=v_provider;
  v_min_used:=case when v_global.minute_at=v_minute then v_global.minute_used else 0 end;
  v_day_used:=case when v_global.day_at=v_day then v_global.day_used else 0 end;
  if p_units > v_policy.global_minute-v_min_used then
    v_retry:=greatest(v_retry,ceil(extract(epoch from v_minute+interval '1 minute'-v_now))::integer); v_scope:='global';
  end if;
  if p_units > v_policy.global_day-v_day_used then
    v_retry:=greatest(v_retry,ceil(extract(epoch from v_day+interval '1 day'-v_now))::integer); v_scope:='global';
  end if;
  if v_retry>0 then return jsonb_build_object('allowed',false,'code','provider_refresh_rate_limited',
    'scope',v_scope,'retryAfterSeconds',v_retry); end if;
  foreach v_bucket in array v_buckets loop
    insert into provider_private.budgets values(v_user,v_bucket,v_minute,p_units,v_day,p_units,v_now)
      on conflict(user_id,bucket) do update set
        minute_used=case when budgets.minute_at=excluded.minute_at then budgets.minute_used+p_units else p_units end,
        day_used=case when budgets.day_at=excluded.day_at then budgets.day_used+p_units else p_units end,
        minute_at=excluded.minute_at,day_at=excluded.day_at,updated_at=excluded.updated_at;
  end loop;
  insert into provider_private.global_budgets values(v_provider,v_minute,p_units,v_day,p_units,v_now)
    on conflict(provider) do update set
      minute_used=case when global_budgets.minute_at=excluded.minute_at then global_budgets.minute_used+p_units else p_units end,
      day_used=case when global_budgets.day_at=excluded.day_at then global_budgets.day_used+p_units else p_units end,
      minute_at=excluded.minute_at,day_at=excluded.day_at,updated_at=excluded.updated_at;
  delete from provider_private.budgets where (user_id,bucket) in (
    select user_id,bucket from provider_private.budgets where updated_at<v_now-interval '2 days'
      order by updated_at limit 100 for update skip locked
  );
  return jsonb_build_object('allowed',true);
end;
$$;
revoke all on function public.reserve_provider_budget(text,text,integer) from public, anon, service_role;
grant execute on function public.reserve_provider_budget(text,text,integer) to authenticated;
