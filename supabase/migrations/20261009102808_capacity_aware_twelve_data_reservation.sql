-- Partial securities grants reuse S2 locks, windows, ledgers, and charging.
-- No capacity defaults, private table exposure, or changes to search/Gold/FX.
create function public.reserve_twelve_data_symbols(p_requested_symbols integer)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_policy provider_private.capacity%rowtype;
  v_user_budget provider_private.budgets%rowtype;
  v_global provider_private.global_budgets%rowtype;
  v_now timestamptz; v_minute timestamptz; v_day timestamptz;
  v_user_minute bigint; v_user_day bigint; v_global_minute bigint; v_global_day bigint;
  v_granted integer; v_retry integer := 0; v_decision jsonb;
begin
  if v_user is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_requested_symbols is null or p_requested_symbols < 1 or p_requested_symbols > 50 then
    raise exception 'invalid symbol reservation' using errcode='22023';
  end if;
  -- Same lock order as reserve_provider_budget and configure_provider_capacity.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('provider-global:twelve_data',0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('provider-budget:' || v_user::text,0));
  select * into v_policy from provider_private.capacity where bucket='twelve_data';
  if not found then
    return jsonb_build_object('grantedSymbolCount',0,'code','provider_capacity_unconfigured');
  end if;
  if not v_policy.enabled then
    return jsonb_build_object('grantedSymbolCount',0,'code','provider_refresh_paused');
  end if;
  v_now:=clock_timestamp(); v_minute:=date_trunc('minute',v_now);
  v_day:=date_trunc('day',v_now at time zone 'UTC') at time zone 'UTC';
  select * into v_user_budget from provider_private.budgets where user_id=v_user and bucket='twelve_data';
  select * into v_global from provider_private.global_budgets where provider='twelve_data';
  v_user_minute:=v_policy.user_minute-case when v_user_budget.minute_at=v_minute then v_user_budget.minute_used else 0 end;
  v_user_day:=v_policy.user_day-case when v_user_budget.day_at=v_day then v_user_budget.day_used else 0 end;
  v_global_minute:=v_policy.global_minute-case when v_global.minute_at=v_minute then v_global.minute_used else 0 end;
  v_global_day:=v_policy.global_day-case when v_global.day_at=v_day then v_global.day_used else 0 end;
  v_granted:=greatest(0,least(p_requested_symbols::bigint,v_user_minute,v_user_day,v_global_minute,v_global_day))::integer;
  if v_granted=0 then
    if v_user_minute<=0 or v_global_minute<=0 then
      v_retry:=ceil(extract(epoch from v_minute+interval '1 minute'-v_now))::integer;
    end if;
    if v_user_day<=0 or v_global_day<=0 then
      v_retry:=greatest(v_retry,ceil(extract(epoch from v_day+interval '1 day'-v_now))::integer);
    end if;
    return jsonb_build_object('grantedSymbolCount',0,'code','provider_refresh_rate_limited','retryAfterSeconds',v_retry);
  end if;
  -- Reentrant transaction locks keep the capacity read and existing charge atomic.
  -- This is the only charge: Edge must not also call reserve_provider_budget.
  v_decision:=public.reserve_provider_budget('twelve_data','market',v_granted);
  if v_decision->>'allowed'='true' then
    return jsonb_build_object('grantedSymbolCount',v_granted);
  end if;
  return jsonb_build_object('grantedSymbolCount',0,'code','provider_budget_unavailable');
end;
$$;
revoke all on function public.reserve_twelve_data_symbols(integer) from public,anon,service_role;
grant execute on function public.reserve_twelve_data_symbols(integer) to authenticated;
