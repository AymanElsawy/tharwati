alter table public.financial_transactions
  add column reverses_transaction_id uuid,
  add column corrects_transaction_id uuid;

alter table public.financial_transactions
  add constraint financial_transactions_reverses_transaction_id_fkey
    foreign key (reverses_transaction_id)
    references public.financial_transactions (id)
    on delete restrict,
  add constraint financial_transactions_corrects_transaction_id_fkey
    foreign key (corrects_transaction_id)
    references public.financial_transactions (id)
    on delete restrict,
  add constraint financial_transactions_reversal_not_self_check
    check (reverses_transaction_id is null or reverses_transaction_id <> id),
  add constraint financial_transactions_correction_not_self_check
    check (corrects_transaction_id is null or corrects_transaction_id <> id);

create unique index financial_transactions_one_reversal_per_transaction_idx
  on public.financial_transactions (reverses_transaction_id)
  where reverses_transaction_id is not null;

create unique index financial_transactions_one_correction_per_transaction_idx
  on public.financial_transactions (corrects_transaction_id)
  where corrects_transaction_id is not null;

comment on column public.financial_transactions.reverses_transaction_id is
  'Links an immutable correction reversal to the posted transaction whose ledger effects it exactly negates.';
comment on column public.financial_transactions.corrects_transaction_id is
  'Links the corrected replacement Buy to its immutable original transaction.';

create or replace function public.edit_investment(
  p_transaction_id uuid,
  p_quantity numeric,
  p_unit_price numeric,
  p_fees numeric,
  p_occurred_at timestamptz,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_original public.financial_transactions%rowtype;
  v_reversal public.financial_transactions%rowtype;
  v_asset_entry public.transaction_entries%rowtype;
  v_fee_entry public.transaction_entries%rowtype;
  v_payment_entry public.transaction_entries%rowtype;
  v_replacement public.financial_transactions%rowtype;
  v_account_currency text;
  v_rate numeric;
  v_gross numeric;
  v_total numeric;
  v_entries jsonb;
  v_holding public.holdings%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  if p_quantity is null or p_quantity <= 0
    or p_unit_price is null or p_unit_price < 0
    or p_fees is null or p_fees < 0
    or p_occurred_at is null
  then
    raise exception 'quantity, unit price, fees, or transaction date is invalid'
      using errcode = '22023';
  end if;

  select * into v_original
  from public.financial_transactions as transactions
  where transactions.id = p_transaction_id
    and transactions.user_id = v_user_id
    and transactions.transaction_type_code = 'buy'
    and transactions.status = 'posted'
  for update;

  if not found then
    raise exception 'posted investment % was not found', p_transaction_id
      using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.financial_transactions as transactions
    where transactions.user_id = v_user_id
      and transactions.corrects_transaction_id = v_original.id
  ) then
    raise exception 'investment % has already been corrected', p_transaction_id
      using errcode = '23505';
  end if;

  select * into strict v_asset_entry
  from public.transaction_entries as entries
  where entries.transaction_id = v_original.id
    and entries.user_id = v_user_id
    and entries.memo = 'investment_asset';

  select * into v_fee_entry
  from public.transaction_entries as entries
  where entries.transaction_id = v_original.id
    and entries.user_id = v_user_id
    and entries.memo = 'investment_fee';

  select * into strict v_payment_entry
  from public.transaction_entries as entries
  where entries.transaction_id = v_original.id
    and entries.user_id = v_user_id
    and entries.memo = 'investment_payment';

  if v_asset_entry.quantity_delta is null
    or v_asset_entry.input_quantity is null
    or v_asset_entry.cost_basis_delta is null
    or v_asset_entry.account_cost_basis_delta is null
    or (v_fee_entry.id is not null and (v_fee_entry.cost_basis_delta is null or v_fee_entry.account_cost_basis_delta is null))
  then
    raise exception 'investment % does not contain complete correction metadata', p_transaction_id
      using errcode = '23514';
  end if;

  select accounts.currency_code into strict v_account_currency
  from public.financial_accounts as accounts
  where accounts.id = v_asset_entry.account_id
    and accounts.user_id = v_user_id
    and accounts.is_active;

  insert into public.financial_transactions (
    user_id, transaction_type_code, transaction_currency_code, status,
    occurred_at, description, notes, reverses_transaction_id
  ) values (
    v_user_id, 'adjustment', v_account_currency, 'draft',
    v_original.occurred_at, 'Reversal of corrected investment',
    'System-created immutable correction reversal', v_original.id
  ) returning * into v_reversal;

  insert into public.transaction_entries (
    transaction_id, user_id, account_id, asset_id, entry_side,
    transaction_amount, account_amount, quantity_delta, input_quantity,
    input_quantity_unit, quantity_conversion_factor, cost_basis_delta,
    account_cost_basis_delta, account_fx_rate, account_fx_effective_at,
    account_fx_source, unit_price, memo
  ) values (
    v_reversal.id, v_user_id, v_asset_entry.account_id, v_asset_entry.asset_id,
    case v_asset_entry.entry_side when 'debit' then 'credit' else 'debit' end,
    v_asset_entry.account_amount, v_asset_entry.account_amount,
    -v_asset_entry.quantity_delta, -v_asset_entry.input_quantity,
    v_asset_entry.input_quantity_unit, v_asset_entry.quantity_conversion_factor,
    -v_asset_entry.account_cost_basis_delta, -v_asset_entry.account_cost_basis_delta,
    1, v_original.occurred_at,
    'identity', null,
    'investment_correction_asset_reversal'
  );

  if v_fee_entry.id is not null then
    insert into public.transaction_entries (
      transaction_id, user_id, account_id, asset_id, entry_side,
      transaction_amount, account_amount, cost_basis_delta,
      account_cost_basis_delta, account_fx_rate, account_fx_effective_at,
      account_fx_source, unit_price, memo
    ) values (
      v_reversal.id, v_user_id, v_fee_entry.account_id, v_fee_entry.asset_id,
      case v_fee_entry.entry_side when 'debit' then 'credit' else 'debit' end,
      v_fee_entry.account_amount, v_fee_entry.account_amount,
      -v_fee_entry.account_cost_basis_delta, -v_fee_entry.account_cost_basis_delta,
      1, v_original.occurred_at,
      'identity', null,
      'investment_correction_fee_reversal'
    );
  end if;

  insert into public.transaction_entries (
    transaction_id, user_id, account_id, entry_side,
    transaction_amount, account_amount, memo
  ) values (
    v_reversal.id, v_user_id, v_payment_entry.account_id,
    case v_payment_entry.entry_side when 'debit' then 'credit' else 'debit' end,
    v_payment_entry.account_amount, v_payment_entry.account_amount,
    'investment_correction_payment_reversal'
  );

  perform public.post_transaction(v_reversal.id);

  select rate into v_rate
  from public.resolve_historical_exchange_rate(
    v_original.transaction_currency_code,
    v_account_currency,
    p_occurred_at
  );

  if v_rate is null or v_rate <= 0 then
    raise exception 'a historical exchange rate is required for the corrected investment'
      using errcode = 'P0002';
  end if;

  v_gross := p_quantity * p_unit_price;
  v_total := v_gross + p_fees;

  insert into public.financial_transactions (
    user_id, transaction_type_code, transaction_currency_code, status,
    occurred_at, description, notes, corrects_transaction_id
  ) values (
    v_user_id, 'buy', v_original.transaction_currency_code, 'draft',
    p_occurred_at, v_original.description,
    nullif(pg_catalog.btrim(p_notes), ''), v_original.id
  ) returning * into v_replacement;

  insert into public.transaction_entries (
    transaction_id, user_id, account_id, asset_id, entry_side,
    transaction_amount, account_amount, quantity_delta, unit_price,
    cost_basis_delta, memo
  ) values (
    v_replacement.id, v_user_id, v_asset_entry.account_id,
    v_asset_entry.asset_id, 'debit', v_gross, v_gross * v_rate,
    p_quantity, p_unit_price, v_gross, 'investment_asset'
  );

  if p_fees > 0 then
    insert into public.transaction_entries (
      transaction_id, user_id, account_id, asset_id, entry_side,
      transaction_amount, account_amount, cost_basis_delta, memo
    ) values (
      v_replacement.id, v_user_id, v_asset_entry.account_id,
      v_asset_entry.asset_id, 'debit', p_fees, p_fees * v_rate,
      p_fees, 'investment_fee'
    );
  end if;

  insert into public.transaction_entries (
    transaction_id, user_id, account_id, entry_side,
    transaction_amount, account_amount, memo
  ) values (
    v_replacement.id, v_user_id, v_asset_entry.account_id, 'credit',
    v_total, v_total * v_rate, 'investment_payment'
  );

  select * into v_replacement from public.post_transaction(v_replacement.id);

  select * into v_holding from public.holdings
  where user_id = v_user_id
    and account_id = v_asset_entry.account_id
    and asset_id = v_asset_entry.asset_id;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(entries) order by entries.created_at, entries.id), '[]'::jsonb)
  into v_entries
  from public.transaction_entries as entries
  where entries.transaction_id = v_replacement.id;

  return pg_catalog.jsonb_build_object(
    'original_transaction', pg_catalog.to_jsonb(v_original),
    'reversal_transaction', pg_catalog.to_jsonb(v_reversal),
    'replacement', pg_catalog.jsonb_build_object(
      'transaction', pg_catalog.to_jsonb(v_replacement),
      'entries', v_entries,
      'holding', pg_catalog.to_jsonb(v_holding)
    )
  );
exception
  when no_data_found or too_many_rows then
    raise exception 'investment % does not have the expected immutable Buy ledger shape', p_transaction_id
      using errcode = '23514';
end;
$$;

comment on function public.edit_investment(uuid, numeric, numeric, numeric, timestamptz, text) is
  'Atomically corrects an owned posted Buy by posting an exact linked reversal and a replacement Buy through add_investment. Account and asset identity remain locked; the original ledger is never updated.';

revoke all on function public.edit_investment(uuid, numeric, numeric, numeric, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.edit_investment(uuid, numeric, numeric, numeric, timestamptz, text)
  to authenticated;
