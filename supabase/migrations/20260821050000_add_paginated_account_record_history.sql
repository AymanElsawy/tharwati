-- Server-side, cursor-paginated effective Account Record history.

create index if not exists financial_transactions_user_occurred_at_id_desc_idx
  on public.financial_transactions (user_id, occurred_at desc, id desc);

create or replace function public.get_account_record_history(
  p_account_id uuid,
  p_cursor_occurred_at timestamptz default null,
  p_cursor_id uuid default null,
  p_page_size integer default 50,
  p_time_zone text default 'UTC'
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
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if (p_cursor_occurred_at is null) <> (p_cursor_id is null) then
    raise exception 'history cursor must include both occurred_at and id' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = v_time_zone
  ) then
    raise exception 'history time zone is invalid' using errcode = '22023';
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
    where e.account_id = p_account_id
      and e.user_id = v_user_id
      and e.asset_id is null
      -- A reversal is audit-only, and the original it references is no longer effective.
      and t.reverses_transaction_id is null
      and not exists (
        select 1
        from public.financial_transactions reversal
        where reversal.user_id = v_user_id
          and reversal.reverses_transaction_id = t.id
      )
      -- A correction replacement remains visible; the original it supersedes does not.
      and not exists (
        select 1
        from public.financial_transactions replacement
        where replacement.user_id = v_user_id
          and replacement.corrects_transaction_id = t.id
      )
  ), page_records as materialized (
    select
      r.*
    from effective_records r
    where p_cursor_occurred_at is null
      or (r.occurred_at, r.id) < (p_cursor_occurred_at, p_cursor_id)
    order by r.occurred_at desc, r.id desc
    limit v_page_size
  ), page_dates as materialized (
    select distinct local_date
    from page_records
  ), page_date_ranges as materialized (
    select
      local_date,
      local_date::timestamp at time zone v_time_zone as occurred_at_start,
      (local_date + 1)::timestamp at time zone v_time_zone as occurred_at_end
    from page_dates
  ), daily_totals as (
    select
      d.local_date,
      sum(r.signed_amount) as daily_net
    from page_date_ranges d
    join effective_records r
      on r.occurred_at >= d.occurred_at_start
     and r.occurred_at < d.occurred_at_end
    group by d.local_date
  )
  select
    r.id,
    r.occurred_at,
    r.transaction_type_code,
    r.description,
    r.notes,
    r.main_category_id,
    r.subcategory_id,
    r.account_id,
    r.entry_side,
    r.account_amount::text,
    r.currency_code,
    r.local_date,
    d.daily_net::text
  from page_records r
  join daily_totals d
    on d.local_date = r.local_date
  order by r.occurred_at desc, r.id desc
  limit v_page_size;
end;
$$;

revoke all on function public.get_account_record_history(uuid, timestamptz, uuid, integer, text) from public, anon;
grant execute on function public.get_account_record_history(uuid, timestamptz, uuid, integer, text) to authenticated;

comment on function public.get_account_record_history(uuid, timestamptz, uuid, integer, text) is
  'Returns visible effective Account Record history for one owned Cash/Bank account using an occurred_at/id keyset cursor, including complete native-currency totals for each supplied local calendar date.';
