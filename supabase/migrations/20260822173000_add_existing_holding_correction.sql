-- Atomic correction for posted Brokerage Existing Holding opening positions.
-- The public RPC composes the existing exact reversal with a replacement opening
-- position in one transaction; neither posted transaction is ever mutated.

create function public.post_existing_holding_with_links_internal(
  p_account_id uuid,
  p_asset_id uuid,
  p_quantity numeric,
  p_average_cost numeric,
  p_occurred_at timestamptz,
  p_notes text,
  p_account_fx_rate numeric,
  p_corrects_transaction_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_account public.financial_accounts%rowtype;
  v_asset public.assets%rowtype;
  v_transaction public.financial_transactions%rowtype;
  v_holding public.holdings%rowtype;
  v_total_cost_basis numeric;
  v_account_cost_basis numeric;
  v_occurred_at timestamptz := coalesce(p_occurred_at, now());
  v_entries jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_account_id is null or p_asset_id is null
    or p_quantity is null or p_quantity <= 0
    or p_average_cost is null or p_average_cost <= 0 then
    raise exception 'account, asset, quantity, and average historical cost are required'
      using errcode = '22023';
  end if;

  select * into v_account
  from public.financial_accounts as accounts
  where accounts.id = p_account_id
    and accounts.user_id = v_user_id
    and accounts.is_active
    and accounts.account_type_code = 'brokerage'
  for update;
  if not found then
    raise exception 'selected active Brokerage account is not available' using errcode = 'P0002';
  end if;

  select * into v_asset
  from public.assets as assets
  where assets.id = p_asset_id
    and assets.is_active
    and (assets.user_id is null or assets.user_id = v_user_id)
  for share;
  if not found then
    raise exception 'selected visible asset is not available' using errcode = 'P0002';
  end if;

  v_total_cost_basis := p_quantity * p_average_cost;
  if v_asset.currency_code = v_account.currency_code then
    if p_account_fx_rate is not null then
      raise exception 'account FX rate is not accepted when asset and Brokerage currencies match'
        using errcode = '22023';
    end if;
    v_account_cost_basis := v_total_cost_basis;
  else
    if p_account_fx_rate is null or p_account_fx_rate <= 0 then
      raise exception 'cross-currency existing holdings require a positive historical account FX rate'
        using errcode = '22023';
    end if;
    v_account_cost_basis := pg_catalog.round(v_total_cost_basis * p_account_fx_rate, 10);
  end if;

  insert into public.financial_transactions (
    user_id, transaction_type_code, transaction_currency_code, status,
    occurred_at, description, notes, corrects_transaction_id
  ) values (
    v_user_id, 'opening_position', v_asset.currency_code, 'draft',
    v_occurred_at, 'Existing holding: ' || v_asset.name,
    nullif(pg_catalog.btrim(p_notes), ''), p_corrects_transaction_id
  ) returning * into v_transaction;

  insert into public.transaction_entries (
    transaction_id, user_id, account_id, asset_id, entry_side,
    transaction_amount, account_amount, quantity_delta, cost_basis_delta,
    account_fx_rate, account_fx_effective_at, account_fx_source, unit_price, memo
  ) values (
    v_transaction.id, v_user_id, v_account.id, v_asset.id, 'debit',
    v_total_cost_basis, v_account_cost_basis, p_quantity, v_total_cost_basis,
    case when v_asset.currency_code = v_account.currency_code then null else p_account_fx_rate end,
    case when v_asset.currency_code = v_account.currency_code then null else v_occurred_at end,
    case when v_asset.currency_code = v_account.currency_code then null else 'opening_position_input' end,
    p_average_cost, 'existing_holding_asset'
  ), (
    v_transaction.id, v_user_id, null, null, 'credit',
    v_total_cost_basis, v_total_cost_basis, null, null,
    null, null, null, null, 'existing_holding_opening_equity'
  );

  select * into v_transaction from public.post_transaction(v_transaction.id);
  select * into v_holding
  from public.holdings as holdings
  where holdings.user_id = v_user_id
    and holdings.account_id = v_account.id
    and holdings.asset_id = v_asset.id;
  select coalesce(
    pg_catalog.jsonb_agg(pg_catalog.to_jsonb(entries) order by entries.created_at, entries.id),
    '[]'::jsonb
  ) into v_entries
  from public.transaction_entries as entries
  where entries.transaction_id = v_transaction.id;

  return pg_catalog.jsonb_build_object(
    'account', pg_catalog.to_jsonb(v_account),
    'asset', pg_catalog.to_jsonb(v_asset),
    'transaction', pg_catalog.to_jsonb(v_transaction),
    'entries', v_entries,
    'holding', pg_catalog.to_jsonb(v_holding)
  );
end;
$$;

-- Preserve the deployed Add Existing Holding path while sharing the linked
-- posting implementation used by correction.
create or replace function public.post_existing_holding_internal(
  p_account_id uuid,
  p_asset_id uuid,
  p_quantity numeric,
  p_average_cost numeric,
  p_occurred_at timestamptz,
  p_notes text,
  p_account_fx_rate numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.post_existing_holding_with_links_internal(
    p_account_id, p_asset_id, p_quantity, p_average_cost,
    p_occurred_at, p_notes, p_account_fx_rate, null
  );
end;
$$;

create function public.correct_existing_holding(
  p_original_transaction_id uuid,
  p_quantity numeric,
  p_average_cost numeric,
  p_occurred_at timestamptz,
  p_notes text,
  p_account_fx_rate numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_original public.financial_transactions%rowtype;
  v_asset_entry public.transaction_entries%rowtype;
  v_reversal_result jsonb;
  v_replacement_result jsonb;
  v_holding public.holdings%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_original
  from public.financial_transactions as transactions
  where transactions.id = p_original_transaction_id
    and transactions.user_id = v_user_id
    and transactions.transaction_type_code = 'opening_position'
    and transactions.status = 'posted'
  for update;
  if not found then
    raise exception 'posted existing holding is not available for correction' using errcode = 'P0002';
  end if;
  if exists (
    select 1
    from public.financial_transactions as transactions
    where transactions.reverses_transaction_id = v_original.id
       or transactions.corrects_transaction_id = v_original.id
  ) then
    raise exception 'existing holding has already been changed' using errcode = '23505';
  end if;

  select * into strict v_asset_entry
  from public.transaction_entries as entries
  where entries.transaction_id = v_original.id
    and entries.user_id = v_user_id
    and entries.memo = 'existing_holding_asset';

  -- reverse_existing_holding acquires the per-holding advisory lock, validates
  -- the exact immutable shape, and preflights the resulting projection before
  -- it creates any draft. A later error rolls this entire function back.
  v_reversal_result := public.reverse_existing_holding(v_original.id);
  v_replacement_result := public.post_existing_holding_with_links_internal(
    v_asset_entry.account_id,
    v_asset_entry.asset_id,
    p_quantity,
    p_average_cost,
    p_occurred_at,
    p_notes,
    p_account_fx_rate,
    v_original.id
  );

  select * into v_holding
  from public.holdings as holdings
  where holdings.user_id = v_user_id
    and holdings.account_id = v_asset_entry.account_id
    and holdings.asset_id = v_asset_entry.asset_id;

  return pg_catalog.jsonb_build_object(
    'original_transaction', pg_catalog.to_jsonb(v_original),
    'reversal_transaction', v_reversal_result -> 'reversal_transaction',
    'reversal_entries', v_reversal_result -> 'entries',
    'replacement_transaction', v_replacement_result -> 'transaction',
    'replacement_entries', v_replacement_result -> 'entries',
    'holding', pg_catalog.to_jsonb(v_holding)
  );
exception
  when no_data_found or too_many_rows then
    raise exception 'existing holding does not contain the expected immutable ledger shape'
      using errcode = '23514';
end;
$$;

revoke all on function public.post_existing_holding_with_links_internal(uuid, uuid, numeric, numeric, timestamptz, text, numeric, uuid)
  from public, anon, authenticated;
revoke all on function public.post_existing_holding_internal(uuid, uuid, numeric, numeric, timestamptz, text, numeric)
  from public, anon, authenticated;
revoke all on function public.correct_existing_holding(uuid, numeric, numeric, timestamptz, text, numeric)
  from public, anon;
grant execute on function public.correct_existing_holding(uuid, numeric, numeric, timestamptz, text, numeric)
  to authenticated;

comment on function public.correct_existing_holding(uuid, numeric, numeric, timestamptz, text, numeric) is
  'Atomically corrects an owned posted Existing Holding opening position by posting its exact immutable reversal and linked replacement. Quantity is canonical; average cost is in the asset currency; no Brokerage cash movement is created.';
