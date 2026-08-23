-- Existing holdings are opening positions: they establish asset quantity and
-- historical cost basis without moving Brokerage Available Cash.
insert into public.transaction_types (code, name, is_active)
values
  ('opening_position', 'Existing holding', true),
  ('opening_position_reversal', 'Existing holding reversal', true)
on conflict (code) do update
set name = excluded.name, is_active = true;

alter table public.transaction_entries
  drop constraint if exists transaction_entries_accountless_external_flow_check;

alter table public.transaction_entries
  add constraint transaction_entries_accountless_external_flow_check check (
    account_id is not null
    or (
      memo in (
        'owner_contribution',
        'owner_draw',
        'metal_purchase_funding',
        'metal_purchase_funding_reversal',
        'existing_holding_opening_equity',
        'existing_holding_opening_equity_reversal'
      )
      and asset_id is null
      and quantity_delta is null
      and unit_price is null
      and purity is null
    )
  );

create function public.post_existing_holding_internal(
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
    raise exception 'selected active Brokerage account is not available'
      using errcode = 'P0002';
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
    occurred_at, description, notes
  ) values (
    v_user_id, 'opening_position', v_asset.currency_code, 'draft',
    v_occurred_at, 'Existing holding: ' || v_asset.name,
    nullif(pg_catalog.btrim(p_notes), '')
  ) returning * into v_transaction;

  -- This is an asset-side holding effect, not a Brokerage cash movement.
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
    'existing_holding_opening_equity'
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

create function public.add_existing_holding(
  p_account_id uuid,
  p_asset_id uuid,
  p_quantity numeric,
  p_average_cost numeric,
  p_occurred_at timestamptz default null,
  p_notes text default null,
  p_account_fx_rate numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.post_existing_holding_internal(
    p_account_id,
    p_asset_id,
    p_quantity,
    p_average_cost,
    p_occurred_at,
    p_notes,
    p_account_fx_rate
  );
end;
$$;

create function public.reverse_existing_holding(
  p_transaction_id uuid
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
  v_opening_entry public.transaction_entries%rowtype;
  v_account public.financial_accounts%rowtype;
  v_reversal public.financial_transactions%rowtype;
  v_holding public.holdings%rowtype;
  v_entry_count integer;
  v_current_quantity numeric;
  v_current_cost_basis numeric;
  v_remaining_quantity numeric;
  v_remaining_cost_basis numeric;
  v_entries jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_original
  from public.financial_transactions as transactions
  where transactions.id = p_transaction_id
    and transactions.user_id = v_user_id
    and transactions.transaction_type_code = 'opening_position'
    and transactions.status = 'posted'
  for update;
  if not found then
    raise exception 'posted existing holding is not available for reversal'
      using errcode = 'P0002';
  end if;
  if exists (
    select 1
    from public.financial_transactions as transactions
    where transactions.reverses_transaction_id = v_original.id
  ) then
    raise exception 'existing holding has already been reversed' using errcode = '23505';
  end if;

  select count(*) into v_entry_count
  from public.transaction_entries as entries
  where entries.transaction_id = v_original.id;

  select * into strict v_asset_entry
  from public.transaction_entries as entries
  where entries.transaction_id = v_original.id
    and entries.user_id = v_user_id
    and entries.memo = 'existing_holding_asset';

  select * into strict v_opening_entry
  from public.transaction_entries as entries
  where entries.transaction_id = v_original.id
    and entries.user_id = v_user_id
    and entries.memo = 'existing_holding_opening_equity';

  if v_entry_count <> 2
    or v_asset_entry.entry_side <> 'debit'
    or v_asset_entry.account_id is null
    or v_asset_entry.asset_id is null
    or v_asset_entry.quantity_delta is null
    or v_asset_entry.cost_basis_delta is null
    or v_asset_entry.account_cost_basis_delta is null
    or v_asset_entry.account_fx_rate is null
    or v_asset_entry.account_fx_effective_at is null
    or nullif(pg_catalog.btrim(v_asset_entry.account_fx_source), '') is null
    or v_opening_entry.entry_side <> 'credit'
    or v_opening_entry.account_id is not null
    or v_opening_entry.asset_id is not null
    or v_opening_entry.transaction_amount <> v_asset_entry.transaction_amount
  then
    raise exception 'existing holding does not contain the expected immutable ledger shape'
      using errcode = '23514';
  end if;

  select * into v_account
  from public.financial_accounts as accounts
  where accounts.id = v_asset_entry.account_id
    and accounts.user_id = v_user_id
    and accounts.is_active
    and accounts.account_type_code = 'brokerage'
  for update;
  if not found then
    raise exception 'linked active Brokerage account is not available'
      using errcode = 'P0002';
  end if;

  -- Serialize this preflight with the projection rebuild used by every
  -- asset posting, then validate the exact post-reversal derived state
  -- before a draft reversal can be created.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_account.id::text || ':' || v_asset_entry.asset_id::text,
      0
    )
  );

  perform 1
  from public.holdings as holdings
  where holdings.user_id = v_user_id
    and holdings.account_id = v_account.id
    and holdings.asset_id = v_asset_entry.asset_id
  for update;

  select
    coalesce(sum(entries.quantity_delta), 0::numeric),
    coalesce(sum(entries.account_cost_basis_delta), 0::numeric)
  into v_current_quantity, v_current_cost_basis
  from public.transaction_entries as entries
  join public.financial_transactions as transactions
    on transactions.id = entries.transaction_id
  where entries.user_id = v_user_id
    and entries.account_id = v_account.id
    and entries.asset_id = v_asset_entry.asset_id
    and transactions.status = 'posted';

  v_remaining_quantity := v_current_quantity - v_asset_entry.quantity_delta;
  v_remaining_cost_basis := v_current_cost_basis
    - v_asset_entry.account_cost_basis_delta;

  -- Keep this exactly aligned with rebuild_holding_projection: quantity and
  -- cost basis cannot be negative, and a zero quantity requires zero basis.
  if v_remaining_quantity < 0 then
    raise exception 'existing holding reversal would make the holding quantity negative'
      using errcode = '23514';
  end if;
  if v_remaining_cost_basis < 0 then
    raise exception 'existing holding reversal would make the holding cost basis negative'
      using errcode = '23514';
  end if;
  if v_remaining_quantity = 0 and v_remaining_cost_basis <> 0 then
    raise exception 'existing holding reversal would leave zero quantity with non-zero cost basis'
      using errcode = '23514';
  end if;

  insert into public.financial_transactions (
    user_id, transaction_type_code, transaction_currency_code, status,
    occurred_at, description, notes, reverses_transaction_id
  ) values (
    v_user_id, 'opening_position_reversal', v_original.transaction_currency_code,
    'draft', now(), 'Reversal of existing holding',
    'Reversal of ' || v_original.id, v_original.id
  ) returning * into v_reversal;

  insert into public.transaction_entries (
    transaction_id, user_id, account_id, asset_id, entry_side,
    transaction_amount, account_amount, quantity_delta, cost_basis_delta,
    account_fx_rate, account_fx_effective_at, account_fx_source, unit_price, memo
  ) values (
    v_reversal.id, v_user_id, v_account.id, v_asset_entry.asset_id, 'credit',
    v_asset_entry.transaction_amount, v_asset_entry.account_amount,
    -v_asset_entry.quantity_delta, -v_asset_entry.cost_basis_delta,
    v_asset_entry.account_fx_rate, v_asset_entry.account_fx_effective_at,
    v_asset_entry.account_fx_source,
    null, 'existing_holding_asset_reversal'
  ), (
    v_reversal.id, v_user_id, null, null, 'debit',
    v_opening_entry.transaction_amount, v_opening_entry.account_amount,
    null, null, 'existing_holding_opening_equity_reversal'
  );

  select * into v_reversal from public.post_transaction(v_reversal.id);

  select * into v_holding
  from public.holdings as holdings
  where holdings.user_id = v_user_id
    and holdings.account_id = v_account.id
    and holdings.asset_id = v_asset_entry.asset_id;

  select coalesce(
    pg_catalog.jsonb_agg(pg_catalog.to_jsonb(entries) order by entries.created_at, entries.id),
    '[]'::jsonb
  ) into v_entries
  from public.transaction_entries as entries
  where entries.transaction_id = v_reversal.id;

  return pg_catalog.jsonb_build_object(
    'original_transaction', pg_catalog.to_jsonb(v_original),
    'reversal_transaction', pg_catalog.to_jsonb(v_reversal),
    'entries', v_entries,
    'holding', pg_catalog.to_jsonb(v_holding)
  );
exception
  when no_data_found or too_many_rows then
    raise exception 'existing holding does not contain the expected immutable ledger shape'
      using errcode = '23514';
end;
$$;

comment on function public.add_existing_holding(uuid, uuid, numeric, numeric, timestamptz, text, numeric) is
  'Posts an owned active Brokerage existing holding as an opening position. average_cost is per canonical quantity unit in the asset currency. A positive account FX rate is required only when that currency differs from the Brokerage account; it produces immutable account-currency historical cost basis without a non-asset Brokerage entry, so Available Cash and opening_balance remain unchanged.';

comment on function public.reverse_existing_holding(uuid) is
  'Posts the exact immutable asset-side reversal of an owned existing holding. It never creates a Brokerage cash movement.';

revoke all on function public.post_existing_holding_internal(uuid, uuid, numeric, numeric, timestamptz, text, numeric)
  from public, anon, authenticated;
revoke all on function public.add_existing_holding(uuid, uuid, numeric, numeric, timestamptz, text, numeric)
  from public, anon;
revoke all on function public.reverse_existing_holding(uuid)
  from public, anon;
grant execute on function public.add_existing_holding(uuid, uuid, numeric, numeric, timestamptz, text, numeric)
  to authenticated;
grant execute on function public.reverse_existing_holding(uuid)
  to authenticated;
