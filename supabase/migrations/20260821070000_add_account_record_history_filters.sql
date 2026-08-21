-- Server-side filters for cursor-paginated effective Account Record history.
-- Keep the five-argument RPC available for already-deployed clients; the
-- extended overload is selected when the filter arguments are supplied.

create index if not exists transaction_entries_user_account_record_history_idx
  on public.transaction_entries (user_id, account_id, transaction_id)
  where asset_id is null;

create function public.get_account_record_history(
  p_account_id uuid,
  p_cursor_occurred_at timestamptz,
  p_cursor_id uuid,
  p_page_size integer,
  p_time_zone text,
  p_search text default null,
  p_from_date date default null,
  p_to_date date default null,
  p_record_type text default null,
  p_main_category_id uuid default null,
  p_subcategory_id uuid default null,
  p_min_amount numeric default null,
  p_max_amount numeric default null
)
returns table (
  id uuid,
  occurred_at timestamptz,
  transaction_type_code text,
  description text,
  notes text,
  main_category_id uuid,
  subcategory_id uuid,
  account_id uuid,
  entry_side text,
  account_amount text,
  currency_code text,
  local_date date,
  daily_net text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_page_size integer := least(greatest(coalesce(p_page_size, 50), 1), 100);
  v_time_zone text := coalesce(nullif(btrim(p_time_zone), ''), 'UTC');
  v_search text := nullif(btrim(p_search), '');
  v_from_occurred_at timestamptz;
  v_to_occurred_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if (p_cursor_occurred_at is null) <> (p_cursor_id is null) then
    raise exception 'history cursor must include both occurred_at and id' using errcode = '22023';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_timezone_names where name = v_time_zone
  ) then
    raise exception 'history time zone is invalid' using errcode = '22023';
  end if;
  if p_record_type is not null and p_record_type not in ('income', 'expense', 'transfer') then
    raise exception 'history record type is invalid' using errcode = '22023';
  end if;
  if p_from_date is not null and p_to_date is not null and p_from_date > p_to_date then
    raise exception 'history start date must not be after end date' using errcode = '22023';
  end if;
  if p_min_amount is not null and p_min_amount < 0
    or p_max_amount is not null and p_max_amount < 0
    or p_min_amount is not null and p_max_amount is not null and p_min_amount > p_max_amount then
    raise exception 'history amount range is invalid' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.financial_accounts a
    where a.id = p_account_id
      and a.user_id = v_user_id
      and a.account_type_code in ('cash', 'bank')
  ) then
    raise exception 'account is not available' using errcode = '42501';
  end if;

  -- Local date filters are inclusive. Convert boundaries once so the base and
  -- Daily Net queries retain range predicates on occurred_at (DST-safe).
  v_from_occurred_at := case when p_from_date is null then null else p_from_date::timestamp at time zone v_time_zone end;
  v_to_occurred_at := case when p_to_date is null then null else (p_to_date + 1)::timestamp at time zone v_time_zone end;

  return query
  with effective_records as not materialized (
    select
      t.id,
      t.occurred_at,
      t.transaction_type_code,
      t.description,
      t.notes,
      t.main_category_id,
      t.subcategory_id,
      e.account_id,
      e.entry_side,
      e.account_amount,
      a.currency_code,
      (t.occurred_at at time zone v_time_zone)::date as local_date,
      case when e.entry_side = 'credit' then -e.account_amount else e.account_amount end as signed_amount
    from public.transaction_entries e
    join public.financial_transactions t
      on t.id = e.transaction_id
     and t.user_id = v_user_id
     and t.status = 'posted'
    join public.financial_accounts a
      on a.id = e.account_id
     and a.user_id = v_user_id
    left join public.record_categories main_category
      on main_category.id = t.main_category_id
     and (main_category.user_id is null or main_category.user_id = v_user_id)
    left join public.record_categories subcategory
      on subcategory.id = t.subcategory_id
     and (subcategory.user_id is null or subcategory.user_id = v_user_id)
    left join public.record_category_overrides main_override
      on main_override.user_id = v_user_id and main_override.category_id = main_category.id
    left join public.record_category_overrides subcategory_override
      on subcategory_override.user_id = v_user_id and subcategory_override.category_id = subcategory.id
    where e.account_id = p_account_id
      and e.user_id = v_user_id
      and e.asset_id is null
      and (v_from_occurred_at is null or t.occurred_at >= v_from_occurred_at)
      and (v_to_occurred_at is null or t.occurred_at < v_to_occurred_at)
      and (p_record_type is null or t.transaction_type_code = p_record_type)
      and (p_main_category_id is null or t.main_category_id = p_main_category_id)
      and (p_subcategory_id is null or t.subcategory_id = p_subcategory_id)
      and (p_min_amount is null or abs(e.account_amount) >= p_min_amount)
      and (p_max_amount is null or abs(e.account_amount) <= p_max_amount)
      and (
        v_search is null
        or coalesce(t.notes, '') ilike '%' || v_search || '%'
        or coalesce(main_override.name, main_category.name, '') ilike '%' || v_search || '%'
        or coalesce(subcategory_override.name, subcategory.name, '') ilike '%' || v_search || '%'
        or coalesce(t.description, '') ilike '%' || v_search || '%'
      )
      and t.reverses_transaction_id is null
      and not exists (
        select 1
        from public.financial_transactions reversal
        where reversal.user_id = v_user_id
          and reversal.reverses_transaction_id = t.id
      )
      and not exists (
        select 1
        from public.financial_transactions replacement
        where replacement.user_id = v_user_id
          and replacement.corrects_transaction_id = t.id
      )
  ), page_records as materialized (
    select r.*
    from effective_records r
    where p_cursor_occurred_at is null
      or (r.occurred_at, r.id) < (p_cursor_occurred_at, p_cursor_id)
    order by r.occurred_at desc, r.id desc
    limit v_page_size
  ), page_dates as materialized (
    select distinct p.local_date from page_records p
  ), page_date_ranges as materialized (
    select
      d.local_date,
      d.local_date::timestamp at time zone v_time_zone as occurred_at_start,
      (d.local_date + 1)::timestamp at time zone v_time_zone as occurred_at_end
    from page_dates d
  ), daily_totals as (
    select d.local_date, sum(r.signed_amount) as daily_net
    from page_date_ranges d
    join effective_records r
      on r.occurred_at >= d.occurred_at_start
     and r.occurred_at < d.occurred_at_end
    group by d.local_date
  )
  select
    r.id, r.occurred_at, r.transaction_type_code, r.description, r.notes,
    r.main_category_id, r.subcategory_id, r.account_id, r.entry_side,
    r.account_amount::text, r.currency_code, r.local_date, d.daily_net::text
  from page_records r
  join daily_totals d on d.local_date = r.local_date
  order by r.occurred_at desc, r.id desc;
end;
$$;

revoke all on function public.get_account_record_history(uuid, timestamptz, uuid, integer, text, text, date, date, text, uuid, uuid, numeric, numeric) from public, anon;
grant execute on function public.get_account_record_history(uuid, timestamptz, uuid, integer, text, text, date, date, text, uuid, uuid, numeric, numeric) to authenticated;

comment on function public.get_account_record_history(uuid, timestamptz, uuid, integer, text, text, date, date, text, uuid, uuid, numeric, numeric) is
  'Returns effective Account Record history for one owned Cash/Bank account using filtered occurred_at/id keyset pagination and complete filtered native-currency daily totals.';
