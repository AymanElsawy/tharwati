-- Brokerage Buy is cash-only within the Brokerage account. It never creates
-- external, Cash, or Bank funding entries.
create function public.post_brokerage_buy_internal(
  p_account_id uuid,
  p_asset_id uuid,
  p_quantity numeric,
  p_unit_price numeric,
  p_occurred_at timestamptz,
  p_notes text,
  p_fees numeric,
  p_account_fx_rate numeric
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
  v_purchase_amount numeric;
  v_fees numeric;
  v_transaction_total numeric;
  v_purchase_account_amount numeric;
  v_fees_account_amount numeric;
  v_required_cash numeric;
  v_occurred_at timestamptz := coalesce(p_occurred_at, now());
  v_entries jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_account_id is null or p_asset_id is null
    or p_quantity is null or p_quantity <= 0
    or p_unit_price is null or p_unit_price <= 0 then
    raise exception 'Brokerage account, asset, quantity, and unit purchase price are required'
      using errcode = '22023';
  end if;
  if coalesce(p_fees, 0::numeric) < 0 then
    raise exception 'Buy fees cannot be negative' using errcode = '22023';
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

  -- Monetary ledger columns are numeric(30,10). Normalize each component
  -- before converting, balancing, validating cash, or inserting entries.
  v_purchase_amount := pg_catalog.round(p_quantity * p_unit_price, 10);
  v_fees := pg_catalog.round(coalesce(p_fees, 0::numeric), 10);
  v_transaction_total := v_purchase_amount + v_fees;
  if v_transaction_total <= 0 then
    raise exception 'normalized Buy total must be positive' using errcode = '22023';
  end if;
  if v_asset.currency_code = v_account.currency_code then
    if p_account_fx_rate is not null then
      raise exception 'account FX rate is not accepted when asset and Brokerage currencies match'
        using errcode = '22023';
    end if;
    v_purchase_account_amount := pg_catalog.round(v_purchase_amount, 10);
    v_fees_account_amount := pg_catalog.round(v_fees, 10);
  else
    if p_account_fx_rate is null or p_account_fx_rate <= 0 then
      raise exception 'cross-currency Brokerage buys require a positive historical account FX rate'
        using errcode = '22023';
    end if;
    v_purchase_account_amount := pg_catalog.round(
      v_purchase_amount * p_account_fx_rate,
      10
    );
    v_fees_account_amount := pg_catalog.round(
      v_fees * p_account_fx_rate,
      10
    );
  end if;
  v_required_cash := v_purchase_account_amount + v_fees_account_amount;

  -- This validates the owned active Brokerage account again while retaining its
  -- row lock, and rejects the complete posting before a draft is created.
  perform public.get_brokerage_available_cash(p_account_id, v_required_cash, true);

  insert into public.financial_transactions (
    user_id, transaction_type_code, transaction_currency_code, status,
    occurred_at, description, notes
  ) values (
    v_user_id, 'buy', v_asset.currency_code, 'draft', v_occurred_at,
    'Buy: ' || v_asset.name, nullif(pg_catalog.btrim(p_notes), '')
  ) returning * into v_transaction;

  insert into public.transaction_entries (
    transaction_id, user_id, account_id, asset_id, entry_side,
    transaction_amount, account_amount, quantity_delta, cost_basis_delta,
    account_fx_rate, account_fx_effective_at, account_fx_source, unit_price, memo
  ) values (
    v_transaction.id, v_user_id, v_account.id, v_asset.id, 'debit',
    v_purchase_amount, v_purchase_account_amount, p_quantity, v_purchase_amount,
    case when v_asset.currency_code = v_account.currency_code then null else p_account_fx_rate end,
    case when v_asset.currency_code = v_account.currency_code then null else v_occurred_at end,
    case when v_asset.currency_code = v_account.currency_code then null else 'buy_input' end,
    p_unit_price, 'brokerage_buy_asset'
  );

  if v_fees > 0 then
    insert into public.transaction_entries (
      transaction_id, user_id, account_id, asset_id, entry_side,
      transaction_amount, account_amount, quantity_delta, cost_basis_delta,
      account_fx_rate, account_fx_effective_at, account_fx_source, unit_price, memo
    ) values (
      v_transaction.id, v_user_id, v_account.id, v_asset.id, 'debit',
      v_fees, v_fees_account_amount, 0::numeric, v_fees,
      case when v_asset.currency_code = v_account.currency_code then null else p_account_fx_rate end,
      case when v_asset.currency_code = v_account.currency_code then null else v_occurred_at end,
      case when v_asset.currency_code = v_account.currency_code then null else 'buy_input' end,
      null, 'brokerage_buy_fee'
    );
  end if;

  insert into public.transaction_entries (
    transaction_id, user_id, account_id, asset_id, entry_side,
    transaction_amount, account_amount, memo
  ) values (
    v_transaction.id, v_user_id, v_account.id, null, 'credit',
    v_transaction_total, v_required_cash, 'brokerage_buy_cash'
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
    'holding', pg_catalog.to_jsonb(v_holding),
    'required_cash', v_required_cash::text
  );
end;
$$;

create function public.add_brokerage_buy(
  p_account_id uuid,
  p_asset_id uuid,
  p_quantity numeric,
  p_unit_price numeric,
  p_occurred_at timestamptz default null,
  p_notes text default null,
  p_fees numeric default 0,
  p_account_fx_rate numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.post_brokerage_buy_internal(
    p_account_id, p_asset_id, p_quantity, p_unit_price, p_occurred_at,
    p_notes, p_fees, p_account_fx_rate
  );
end;
$$;

comment on function public.add_brokerage_buy(uuid, uuid, numeric, numeric, timestamptz, text, numeric, numeric) is
  'Posts an owned active Brokerage Buy using Brokerage Available Cash only. Quantity and unit price are in the asset canonical unit and asset currency; fees are asset-currency acquisition cost and cash outflow. Cross-currency buys require immutable historical account FX. No Cash/Bank or external funding entry is created.';

revoke all on function public.post_brokerage_buy_internal(uuid, uuid, numeric, numeric, timestamptz, text, numeric, numeric)
  from public, anon, authenticated;
revoke all on function public.add_brokerage_buy(uuid, uuid, numeric, numeric, timestamptz, text, numeric, numeric)
  from public, anon;
grant execute on function public.add_brokerage_buy(uuid, uuid, numeric, numeric, timestamptz, text, numeric, numeric)
  to authenticated;
