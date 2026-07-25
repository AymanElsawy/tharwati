create or replace function public.rebuild_holding_projection(
  p_user_id uuid,
  p_account_id uuid default null,
  p_asset_id uuid default null,
  p_pending_transaction_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_effect record;
begin
  if p_user_id is null then
    raise exception 'holding rebuild user is required'
      using errcode = '22023';
  end if;

  if (p_account_id is null) <> (p_asset_id is null) then
    raise exception
      'holding rebuild account and asset scopes must be supplied together'
      using errcode = '22023';
  end if;

  for v_effect in
    select distinct entries.account_id, entries.asset_id
    from public.transaction_entries as entries
    join public.financial_transactions as transactions
      on transactions.id = entries.transaction_id
    where entries.user_id = p_user_id
      and entries.asset_id is not null
      and (
        entries.quantity_delta is not null
        or entries.cost_basis_delta is not null
        or entries.account_cost_basis_delta is not null
      )
      and (
        transactions.status = 'posted'
        or transactions.id = p_pending_transaction_id
      )
      and (
        p_account_id is null
        or (
          entries.account_id = p_account_id
          and entries.asset_id = p_asset_id
        )
      )
    order by entries.account_id, entries.asset_id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        v_effect.account_id::text || ':' || v_effect.asset_id::text,
        0
      )
    );
  end loop;

  for v_effect in
    select
      entries.account_id,
      entries.asset_id,
      coalesce(sum(entries.quantity_delta), 0::numeric) as quantity,
      coalesce(sum(
        case
          when entries.account_cost_basis_delta is not null
            then entries.account_cost_basis_delta
          when entries.cost_basis_delta is not null
            and entries.asset_id is not null
            then entries.account_amount
          else 0
        end
      ), 0::numeric) as total_cost_basis
    from public.transaction_entries as entries
    join public.financial_transactions as transactions
      on transactions.id = entries.transaction_id
    where entries.user_id = p_user_id
      and entries.asset_id is not null
      and (
        transactions.status = 'posted'
        or transactions.id = p_pending_transaction_id
      )
      and (
        p_account_id is null
        or (
          entries.account_id = p_account_id
          and entries.asset_id = p_asset_id
        )
      )
    group by entries.account_id, entries.asset_id
  loop
    if v_effect.quantity < 0 then
      raise exception
        'derived holding quantity is negative for account % and asset %',
        v_effect.account_id,
        v_effect.asset_id
        using errcode = '23514';
    end if;

    if v_effect.quantity > 0
      and v_effect.total_cost_basis < 0
    then
      raise exception
        'derived holding cost basis is negative for account % and asset %',
        v_effect.account_id,
        v_effect.asset_id
        using errcode = '23514';
    end if;
  end loop;

  insert into public.holdings (
    user_id,
    account_id,
    asset_id,
    quantity,
    average_cost,
    total_cost_basis,
    cost_currency_code
  )
  select
    entries.user_id,
    entries.account_id,
    entries.asset_id,
    sum(entries.quantity_delta),
    case
      when sum(entries.quantity_delta) > 0 then
        sum(
          case
            when entries.account_cost_basis_delta is not null
              then entries.account_cost_basis_delta
            when entries.cost_basis_delta is not null
              and entries.asset_id is not null
              then entries.account_amount
            else 0
          end
        ) / sum(entries.quantity_delta)
      else null
    end,
    case
      when sum(entries.quantity_delta) > 0 then
        sum(
          case
            when entries.account_cost_basis_delta is not null
              then entries.account_cost_basis_delta
            when entries.cost_basis_delta is not null
              and entries.asset_id is not null
              then entries.account_amount
            else 0
          end
        )
      else 0::numeric
    end,
    accounts.currency_code
  from public.transaction_entries as entries
  join public.financial_transactions as transactions
    on transactions.id = entries.transaction_id
  join public.financial_accounts as accounts
    on accounts.id = entries.account_id
  where entries.user_id = p_user_id
    and entries.asset_id is not null
    and (
      transactions.status = 'posted'
      or transactions.id = p_pending_transaction_id
    )
    and (
      p_account_id is null
      or (
        entries.account_id = p_account_id
        and entries.asset_id = p_asset_id
      )
    )
  group by
    entries.user_id,
    entries.account_id,
    entries.asset_id,
    accounts.currency_code
  on conflict (account_id, asset_id)
  do update set
    quantity = excluded.quantity,
    average_cost = excluded.average_cost,
    total_cost_basis = excluded.total_cost_basis,
    cost_currency_code = excluded.cost_currency_code;

  delete from public.holdings as holdings
  where holdings.user_id = p_user_id
    and (
      p_account_id is null
      or (
        holdings.account_id = p_account_id
        and holdings.asset_id = p_asset_id
      )
    )
    and not exists (
      select 1
      from public.transaction_entries as entries
      join public.financial_transactions as transactions
        on transactions.id = entries.transaction_id
      where entries.user_id = p_user_id
        and entries.account_id = holdings.account_id
        and entries.asset_id = holdings.asset_id
        and (
          transactions.status = 'posted'
          or transactions.id = p_pending_transaction_id
        )
    );
end;
$$;

comment on function public.rebuild_holding_projection(
  uuid, uuid, uuid, uuid
) is
  'Rebuilds holdings only from posted ledger effects or the one locked pending transaction supplied by the trusted posting path. Cleanup uses the same eligibility rule so it cannot delete a projection immediately before that transaction is posted.';

revoke all on function public.rebuild_holding_projection(
  uuid, uuid, uuid, uuid
) from public, anon, authenticated;
