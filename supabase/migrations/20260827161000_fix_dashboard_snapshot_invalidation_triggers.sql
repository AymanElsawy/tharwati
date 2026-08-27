-- Correct the first snapshot-invalidation migration without changing its
-- already-applied history. Only financial_transactions has a status column;
-- all other covered rows are invalidated by their owner id alone.

create or replace function public.invalidate_dashboard_snapshot_for_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_user_id uuid;
  v_new_user_id uuid;
begin
  if tg_op <> 'INSERT' then
    v_old_user_id := old.user_id;
    if v_old_user_id is not null then
      perform public.invalidate_dashboard_valuation_snapshots(v_old_user_id);
    end if;
  end if;

  if tg_op <> 'DELETE' then
    v_new_user_id := new.user_id;
    if v_new_user_id is not null
      and v_new_user_id is distinct from v_old_user_id then
      perform public.invalidate_dashboard_valuation_snapshots(v_new_user_id);
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.invalidate_dashboard_snapshot_for_financial_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_user_id uuid;
  v_new_user_id uuid;
  v_affects_dashboard boolean := false;
begin
  if tg_op = 'INSERT' then
    v_new_user_id := new.user_id;
    v_affects_dashboard := new.status = 'posted';
  elsif tg_op = 'UPDATE' then
    v_old_user_id := old.user_id;
    v_new_user_id := new.user_id;
    v_affects_dashboard := old.status = 'posted' or new.status = 'posted';
  else
    v_old_user_id := old.user_id;
    v_affects_dashboard := old.status = 'posted';
  end if;

  if v_affects_dashboard and v_old_user_id is not null then
    perform public.invalidate_dashboard_valuation_snapshots(v_old_user_id);
  end if;
  if v_affects_dashboard and v_new_user_id is not null
    and v_new_user_id is distinct from v_old_user_id then
    perform public.invalidate_dashboard_valuation_snapshots(v_new_user_id);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.invalidate_dashboard_snapshot_for_asset()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset_id uuid;
  v_old_user_id uuid;
  v_new_user_id uuid;
  v_was_or_is_global boolean := false;
begin
  if tg_op = 'DELETE' then
    v_asset_id := old.id;
  else
    v_asset_id := new.id;
  end if;

  if tg_op <> 'INSERT' then
    v_old_user_id := old.user_id;
    v_was_or_is_global := v_was_or_is_global or v_old_user_id is null;
    if v_old_user_id is not null then
      perform public.invalidate_dashboard_valuation_snapshots(v_old_user_id);
    end if;
  end if;

  if tg_op <> 'DELETE' then
    v_new_user_id := new.user_id;
    v_was_or_is_global := v_was_or_is_global or v_new_user_id is null;
    if v_new_user_id is not null
      and v_new_user_id is distinct from v_old_user_id then
      perform public.invalidate_dashboard_valuation_snapshots(v_new_user_id);
    end if;
  end if;

  if v_was_or_is_global then
    delete from public.dashboard_valuation_snapshots as snapshots
    where exists (
      select 1
      from public.holdings
      where holdings.user_id = snapshots.user_id
        and holdings.asset_id = v_asset_id
    );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists dashboard_snapshot_financial_transactions on public.financial_transactions;
drop trigger if exists dashboard_snapshot_holdings on public.holdings;
drop trigger if exists dashboard_snapshot_metal_purchases on public.metal_purchases;
drop trigger if exists dashboard_snapshot_accounts on public.financial_accounts;
drop trigger if exists dashboard_snapshot_assets on public.assets;
drop trigger if exists dashboard_snapshot_manual_prices on public.market_prices;

create trigger dashboard_snapshot_financial_transactions
after insert or update or delete on public.financial_transactions
for each row execute function public.invalidate_dashboard_snapshot_for_financial_transaction();

create trigger dashboard_snapshot_holdings
after insert or update or delete on public.holdings
for each row execute function public.invalidate_dashboard_snapshot_for_row();

create trigger dashboard_snapshot_metal_purchases
after insert or update or delete on public.metal_purchases
for each row execute function public.invalidate_dashboard_snapshot_for_row();

create trigger dashboard_snapshot_accounts
after insert or update or delete on public.financial_accounts
for each row execute function public.invalidate_dashboard_snapshot_for_row();

create trigger dashboard_snapshot_assets
after insert or update or delete on public.assets
for each row execute function public.invalidate_dashboard_snapshot_for_asset();

create trigger dashboard_snapshot_manual_prices
after insert or update or delete on public.market_prices
for each row execute function public.invalidate_dashboard_snapshot_for_row();

revoke all on function public.invalidate_dashboard_snapshot_for_row() from public, anon, authenticated;
revoke all on function public.invalidate_dashboard_snapshot_for_financial_transaction() from public, anon, authenticated;
revoke all on function public.invalidate_dashboard_snapshot_for_asset() from public, anon, authenticated;
