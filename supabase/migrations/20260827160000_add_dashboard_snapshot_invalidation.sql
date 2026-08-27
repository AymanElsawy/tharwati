create function public.invalidate_dashboard_valuation_snapshots(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.dashboard_valuation_snapshots
  where user_id = p_user_id;
$$;

create function public.invalidate_dashboard_snapshot_for_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := coalesce(new.user_id, old.user_id);
begin
  if tg_table_name = 'financial_transactions'
    and coalesce(new.status, old.status) <> 'posted' then
    return coalesce(new, old);
  end if;
  if v_user_id is not null then
    perform public.invalidate_dashboard_valuation_snapshots(v_user_id);
  end if;
  return coalesce(new, old);
end;
$$;

create function public.invalidate_dashboard_snapshot_for_asset()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.user_id, old.user_id) is not null then
    perform public.invalidate_dashboard_valuation_snapshots(coalesce(new.user_id, old.user_id));
  else
    delete from public.dashboard_valuation_snapshots as snapshots
    where exists (
      select 1 from public.holdings
      where holdings.user_id = snapshots.user_id
        and holdings.asset_id = coalesce(new.id, old.id)
    );
  end if;
  return coalesce(new, old);
end;
$$;

create trigger dashboard_snapshot_financial_transactions
after insert or update or delete on public.financial_transactions
for each row execute function public.invalidate_dashboard_snapshot_for_row();
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
execute function public.invalidate_dashboard_snapshot_for_row();

revoke all on function public.invalidate_dashboard_valuation_snapshots(uuid) from public, anon, authenticated;
revoke all on function public.invalidate_dashboard_snapshot_for_row() from public, anon, authenticated;
revoke all on function public.invalidate_dashboard_snapshot_for_asset() from public, anon, authenticated;
