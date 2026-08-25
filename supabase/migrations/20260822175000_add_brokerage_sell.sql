-- Brokerage Sell credits only its own Available Cash. Cost basis is reduced
-- proportionally from the effective holding; realized gain/loss is not modeled.
create function public.post_brokerage_sell_internal(
  p_account_id uuid,
  p_asset_id uuid,
  p_quantity numeric,
  p_unit_sale_price numeric,
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
  v_current_quantity numeric;
  v_current_asset_basis numeric;
  v_current_account_basis numeric;
  v_asset_basis_reduction numeric;
  v_account_basis_reduction numeric;
  v_cost_basis_fx_rate numeric;
  v_remaining_quantity numeric;
  v_remaining_account_basis numeric;
  v_gross_proceeds numeric;
  v_fees numeric;
  v_net_proceeds numeric;
  v_gross_account_proceeds numeric;
  v_fees_account_amount numeric;
  v_net_account_proceeds numeric;
  v_occurred_at timestamptz := coalesce(p_occurred_at, now());
  v_entries jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_account_id is null or p_asset_id is null
    or p_quantity is null or p_quantity <= 0
    or p_unit_sale_price is null or p_unit_sale_price <= 0 then
    raise exception 'Brokerage account, asset, quantity, and unit sale price are required'
      using errcode = '22023';
  end if;
  if coalesce(p_fees, 0::numeric) < 0 then
    raise exception 'Sell fees cannot be negative' using errcode = '22023';
  end if;

  select * into v_account from public.financial_accounts as accounts
  where accounts.id = p_account_id and accounts.user_id = v_user_id
    and accounts.is_active and accounts.account_type_code = 'brokerage'
  for update;
  if not found then
    raise exception 'selected active Brokerage account is not available' using errcode = 'P0002';
  end if;

  select * into v_asset from public.assets as assets
  where assets.id = p_asset_id and assets.is_active
    and (assets.user_id is null or assets.user_id = v_user_id)
  for share;
  if not found then
    raise exception 'selected visible asset is not available' using errcode = 'P0002';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_account.id::text || ':' || v_asset.id::text, 0)
  );
  perform 1 from public.holdings as holdings
  where holdings.user_id = v_user_id and holdings.account_id = v_account.id
    and holdings.asset_id = v_asset.id
  for update;

  select coalesce(sum(entries.quantity_delta), 0::numeric),
    coalesce(sum(entries.cost_basis_delta), 0::numeric),
    coalesce(sum(entries.account_cost_basis_delta), 0::numeric)
  into v_current_quantity, v_current_asset_basis, v_current_account_basis
  from public.transaction_entries as entries
  join public.financial_transactions as transactions on transactions.id = entries.transaction_id
  where entries.user_id = v_user_id and entries.account_id = v_account.id
    and entries.asset_id = v_asset.id and transactions.status = 'posted';
  if v_current_quantity <= 0 or p_quantity > v_current_quantity then
    raise exception 'sell quantity exceeds the current holding quantity' using errcode = '23514';
  end if;
  if v_current_asset_basis <= 0 or v_current_account_basis <= 0 then
    raise exception 'current holding does not contain a positive cost basis' using errcode = '23514';
  end if;

  if p_quantity = v_current_quantity then
    v_asset_basis_reduction := v_current_asset_basis;
    v_account_basis_reduction := v_current_account_basis;
  else
    v_asset_basis_reduction := pg_catalog.round(v_current_asset_basis * p_quantity / v_current_quantity, 10);
    v_account_basis_reduction := pg_catalog.round(v_current_account_basis * p_quantity / v_current_quantity, 10);
  end if;
  if v_asset_basis_reduction <= 0 or v_account_basis_reduction <= 0 then
    raise exception 'sell quantity produces an invalid cost basis reduction' using errcode = '23514';
  end if;
  v_remaining_quantity := v_current_quantity - p_quantity;
  v_remaining_account_basis := v_current_account_basis - v_account_basis_reduction;
  if v_remaining_quantity > 0 and v_remaining_account_basis <= 0 then
    raise exception 'partial sell would leave a positive holding with unusable cost basis'
      using errcode = '23514';
  end if;
  if v_remaining_quantity = 0 and v_remaining_account_basis <> 0 then
    raise exception 'full sell must remove the exact remaining account cost basis'
      using errcode = '23514';
  end if;

  v_gross_proceeds := pg_catalog.round(p_quantity * p_unit_sale_price, 10);
  v_fees := pg_catalog.round(coalesce(p_fees, 0::numeric), 10);
  v_net_proceeds := v_gross_proceeds - v_fees;
  if v_net_proceeds <= 0 then
    raise exception 'Sell fees cannot exceed or equal gross proceeds' using errcode = '22023';
  end if;
  if v_asset.currency_code = v_account.currency_code then
    if p_account_fx_rate is not null then
      raise exception 'account FX rate is not accepted when asset and Brokerage currencies match' using errcode = '22023';
    end if;
    v_gross_account_proceeds := v_gross_proceeds;
    v_fees_account_amount := v_fees;
    v_net_account_proceeds := v_net_proceeds;
    v_cost_basis_fx_rate := 1::numeric;
  else
    if p_account_fx_rate is null or p_account_fx_rate <= 0 then
      raise exception 'cross-currency Brokerage sells require a positive historical account FX rate' using errcode = '22023';
    end if;
    v_gross_account_proceeds := pg_catalog.round(v_gross_proceeds * p_account_fx_rate, 10);
    v_fees_account_amount := pg_catalog.round(v_fees * p_account_fx_rate, 10);
    v_net_account_proceeds := v_gross_account_proceeds - v_fees_account_amount;
    v_cost_basis_fx_rate := pg_catalog.round(v_account_basis_reduction / v_asset_basis_reduction, 10);
    if v_cost_basis_fx_rate <= 0 then
      raise exception 'sell cost basis cannot produce a valid historical account FX rate' using errcode = '23514';
    end if;
  end if;

  insert into public.financial_transactions (
    user_id, transaction_type_code, transaction_currency_code, status,
    occurred_at, description, notes
  ) values (
    v_user_id, 'sell', v_asset.currency_code, 'draft', v_occurred_at,
    'Sell: ' || v_asset.name, nullif(pg_catalog.btrim(p_notes), '')
  ) returning * into v_transaction;

  -- Sale proceeds use their own historical FX. The zero-amount cost entry
  -- carries the proportional historical holding basis independently.
  insert into public.transaction_entries (
    transaction_id, user_id, account_id, asset_id, entry_side,
    transaction_amount, account_amount, quantity_delta, cost_basis_delta, account_cost_basis_delta,
    account_fx_rate, account_fx_effective_at, account_fx_source, unit_price, memo
  ) values (
    v_transaction.id, v_user_id, v_account.id, v_asset.id, 'credit',
    v_gross_proceeds, v_gross_account_proceeds, -p_quantity, 0::numeric, null,
    case when v_asset.currency_code = v_account.currency_code then null else p_account_fx_rate end,
    case when v_asset.currency_code = v_account.currency_code then null else v_occurred_at end,
    case when v_asset.currency_code = v_account.currency_code then null else 'sell_input' end,
    p_unit_sale_price, 'brokerage_sell_asset'
  ), (
    v_transaction.id, v_user_id, v_account.id, v_asset.id, 'credit',
    0::numeric, 0::numeric, 0::numeric, -v_asset_basis_reduction, -v_account_basis_reduction,
    case when v_asset.currency_code = v_account.currency_code then null else v_cost_basis_fx_rate end,
    case when v_asset.currency_code = v_account.currency_code then null else v_occurred_at end,
    case when v_asset.currency_code = v_account.currency_code then null else 'sell_cost_basis' end,
    null, 'brokerage_sell_cost_basis'
  ), (
    v_transaction.id, v_user_id, v_account.id, null, 'debit',
    v_net_proceeds, v_net_account_proceeds, null, null, null,
    null, null, null, null, 'brokerage_sell_cash'
  );
  if v_fees > 0 then
    insert into public.transaction_entries (
      transaction_id, user_id, account_id, asset_id, entry_side,
      transaction_amount, account_amount, quantity_delta, cost_basis_delta, account_cost_basis_delta,
      account_fx_rate, account_fx_effective_at, account_fx_source, unit_price, memo
    ) values (
      v_transaction.id, v_user_id, v_account.id, v_asset.id, 'debit',
      v_fees, v_fees_account_amount, 0::numeric, 0::numeric, null,
      case when v_asset.currency_code = v_account.currency_code then null else p_account_fx_rate end,
      case when v_asset.currency_code = v_account.currency_code then null else v_occurred_at end,
      case when v_asset.currency_code = v_account.currency_code then null else 'sell_input' end,
      null, 'brokerage_sell_fee'
    );
  end if;

  select * into v_transaction from public.post_transaction(v_transaction.id);
  select * into v_holding from public.holdings as holdings
  where holdings.user_id = v_user_id and holdings.account_id = v_account.id
    and holdings.asset_id = v_asset.id;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(entries) order by entries.created_at, entries.id), '[]'::jsonb)
  into v_entries from public.transaction_entries as entries where entries.transaction_id = v_transaction.id;
  return pg_catalog.jsonb_build_object(
    'account', pg_catalog.to_jsonb(v_account), 'asset', pg_catalog.to_jsonb(v_asset),
    'transaction', pg_catalog.to_jsonb(v_transaction), 'entries', v_entries,
    'holding', pg_catalog.to_jsonb(v_holding), 'net_account_proceeds', v_net_account_proceeds::text
  );
end;
$$;

create function public.add_brokerage_sell(
  p_account_id uuid,
  p_asset_id uuid,
  p_quantity numeric,
  p_unit_sale_price numeric,
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
  return public.post_brokerage_sell_internal(
    p_account_id, p_asset_id, p_quantity, p_unit_sale_price, p_occurred_at,
    p_notes, p_fees, p_account_fx_rate
  );
end;
$$;

comment on function public.add_brokerage_sell(uuid, uuid, numeric, numeric, timestamptz, text, numeric, numeric) is
  'Posts an owned active Brokerage Sell. Quantity is reduced by a proportional moving-average cost basis reduction; net proceeds after asset-currency fees credit only Brokerage Available Cash. Cross-currency sales require immutable sale FX; cost basis retains its own historical derived FX. No realized P/L, Cash/Bank, or external funding entry is created.';

revoke all on function public.post_brokerage_sell_internal(uuid, uuid, numeric, numeric, timestamptz, text, numeric, numeric) from public, anon, authenticated;
revoke all on function public.add_brokerage_sell(uuid, uuid, numeric, numeric, timestamptz, text, numeric, numeric) from public, anon;
grant execute on function public.add_brokerage_sell(uuid, uuid, numeric, numeric, timestamptz, text, numeric, numeric) to authenticated;

-- Preserve the normal positive native-account amount rule. The sole zero
-- amount exception is the internal, asset-backed carrying-basis reduction.
alter table public.transaction_entries
  drop constraint transaction_entries_account_amount_positive_check;
alter table public.transaction_entries
  add constraint transaction_entries_account_amount_positive_check check (
    account_amount > 0
    or (
      memo = 'brokerage_sell_cost_basis'
      and asset_id is not null
      and account_id is not null
      and quantity_delta = 0
      and transaction_amount = 0
      and cost_basis_delta < 0
      and account_cost_basis_delta < 0
    )
  );
alter table public.transaction_entries
  drop constraint transaction_entries_transaction_amount_positive_check;
alter table public.transaction_entries
  add constraint transaction_entries_transaction_amount_positive_check check (
    transaction_amount > 0
    or (
      memo = 'brokerage_sell_cost_basis'
      and asset_id is not null
      and account_id is not null
      and quantity_delta = 0
      and account_amount = 0
      and cost_basis_delta < 0
      and account_cost_basis_delta < 0
    )
  );

-- The foundation normally derives account cost basis from one immutable FX
-- rate. A Sell needs its independently-derived carrying basis to remain exact
-- while its separate proceeds entries retain the sale FX rate.
create or replace function public.prepare_investment_entry_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text; v_occurred_at timestamptz; v_transaction_currency text;
  v_account_currency text; v_account_type text; v_asset_owner uuid;
  v_canonical_unit text;
begin
  if new.asset_id is null then return new; end if;
  select status, occurred_at, transaction_currency_code into v_status, v_occurred_at, v_transaction_currency
  from public.financial_transactions where id = new.transaction_id and user_id = new.user_id;
  if not found then raise exception 'asset entry does not belong to its transaction owner' using errcode = '23514'; end if;
  if v_status <> 'draft' then return new; end if;
  select currency_code, account_type_code into v_account_currency, v_account_type
  from public.financial_accounts where id = new.account_id and user_id = new.user_id;
  if not found or v_account_type <> 'brokerage' then raise exception 'asset entries require an owned Brokerage account' using errcode = '23514'; end if;
  select user_id, canonical_quantity_unit into v_asset_owner, v_canonical_unit
  from public.assets where id = new.asset_id and is_active;
  if not found or (v_asset_owner is not null and v_asset_owner <> new.user_id) then raise exception 'asset entry references an unavailable asset' using errcode = '23514'; end if;
  if new.quantity_delta is not null and new.quantity_delta <> 0 then
    new.input_quantity := coalesce(new.input_quantity, new.quantity_delta);
    new.input_quantity_unit := coalesce(new.input_quantity_unit, v_canonical_unit);
    new.quantity_conversion_factor := public.quantity_conversion_factor(new.input_quantity_unit, v_canonical_unit);
    new.quantity_delta := new.input_quantity * new.quantity_conversion_factor;
  else
    new.input_quantity := null; new.input_quantity_unit := null; new.quantity_conversion_factor := null;
  end if;
  if new.cost_basis_delta is null then raise exception 'asset entries require a signed cost basis effect' using errcode = '23514'; end if;
  if v_transaction_currency = v_account_currency then
    new.account_cost_basis_delta := new.cost_basis_delta;
    new.account_fx_rate := 1::numeric; new.account_fx_effective_at := v_occurred_at; new.account_fx_source := 'identity';
  else
    if new.account_fx_rate is null or new.account_fx_rate <= 0 or new.account_fx_effective_at is null or nullif(btrim(new.account_fx_source), '') is null then raise exception 'cross-currency asset entries require immutable historical FX metadata' using errcode = '22023'; end if;
    if new.account_amount <> pg_catalog.round(new.transaction_amount * new.account_fx_rate, 10) then raise exception 'account amount does not match the supplied historical FX rate' using errcode = '23514'; end if;
    if new.memo = 'brokerage_sell_cost_basis' then
      if new.transaction_amount <> 0 or new.account_amount <> 0 or new.quantity_delta <> 0 or new.account_cost_basis_delta is null then
        raise exception 'Sell cost basis entry must be a zero-cash explicit carrying-basis adjustment' using errcode = '23514';
      end if;
    else
      new.account_cost_basis_delta := pg_catalog.round(new.cost_basis_delta * new.account_fx_rate, 10);
    end if;
    new.account_fx_source := btrim(new.account_fx_source);
  end if;
  return new;
end;
$$;
