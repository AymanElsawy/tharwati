-- Brokerage cash transfers use the shared immutable ledger without making
-- Brokerage a general Account Records account.
create or replace function public.validate_account_record_entry_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transaction_type text;
begin
  select transaction_type_code into v_transaction_type
  from public.financial_transactions
  where id = new.transaction_id and user_id = new.user_id;

  if not found then
    raise exception 'transaction entry does not belong to its transaction owner'
      using errcode = '23514';
  end if;

  -- Account Records remain Cash/Bank-only. The two named Brokerage transfer
  -- flows are the sole exception and still cannot carry asset effects.
  if v_transaction_type in ('income', 'expense', 'transfer') then
    if new.account_id is not null and not exists (
      select 1
      from public.financial_accounts as accounts
      where accounts.id = new.account_id
        and accounts.user_id = new.user_id
        and (
          accounts.account_type_code in ('cash', 'bank')
          or (
            v_transaction_type = 'transfer'
            and accounts.account_type_code = 'brokerage'
            and new.memo in (
              'brokerage_cash_transfer_sent',
              'brokerage_cash_transfer_received'
            )
          )
        )
    ) then
      raise exception 'transaction entry account is not supported by this record flow'
        using errcode = '23514';
    end if;

    if new.asset_id is not null or new.quantity_delta is not null
      or new.unit_price is not null or new.purity is not null then
      raise exception 'account records cannot contain asset or quantity effects'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create function public.post_brokerage_cash_transfer_internal(
  p_source_account_id uuid,
  p_destination_account_id uuid,
  p_amount numeric,
  p_received_amount numeric,
  p_occurred_at timestamptz,
  p_notes text,
  p_reverses_transaction_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_source public.financial_accounts%rowtype;
  v_destination public.financial_accounts%rowtype;
  v_locked public.financial_accounts%rowtype;
  v_source_balance numeric;
  v_destination_balance numeric;
  v_received numeric;
  v_transaction public.financial_transactions%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_source_account_id is null or p_destination_account_id is null
    or p_source_account_id = p_destination_account_id then
    raise exception 'source and destination accounts must be different' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 or p_occurred_at is null then
    raise exception 'transfer amount and date are required' using errcode = '22023';
  end if;

  -- Lock both accounts in UUID order before any balance validation.
  for v_locked in
    select *
    from public.financial_accounts
    where id in (p_source_account_id, p_destination_account_id)
      and user_id = v_user_id
      and is_active
    order by id
    for update
  loop
    if v_locked.id = p_source_account_id then v_source := v_locked; end if;
    if v_locked.id = p_destination_account_id then v_destination := v_locked; end if;
  end loop;

  if v_source.id is null or v_destination.id is null then
    raise exception 'selected active accounts are not available' using errcode = '42501';
  end if;
  if not (
    (v_source.account_type_code in ('cash', 'bank') and v_destination.account_type_code = 'brokerage')
    or (v_source.account_type_code = 'brokerage' and v_destination.account_type_code in ('cash', 'bank'))
  ) then
    raise exception 'transfer must be between Cash or Bank and Brokerage' using errcode = '22023';
  end if;

  v_received := case
    when v_source.currency_code = v_destination.currency_code then p_amount
    else p_received_amount
  end;
  if v_received is null or v_received <= 0 then
    raise exception 'received amount must be positive' using errcode = '22023';
  end if;

  if v_source.account_type_code = 'brokerage' then
    perform public.get_brokerage_available_cash(v_source.id, p_amount, true);
  else
    select accounts.opening_balance + coalesce(sum(
      case entries.entry_side when 'debit' then entries.account_amount when 'credit' then -entries.account_amount end
    ) filter (where transactions.status = 'posted'), 0::numeric)
    into v_source_balance
    from public.financial_accounts as accounts
    left join public.transaction_entries as entries
      on entries.account_id = accounts.id and entries.asset_id is null
    left join public.financial_transactions as transactions
      on transactions.id = entries.transaction_id and transactions.user_id = accounts.user_id
    where accounts.id = v_source.id
    group by accounts.opening_balance;

    if v_source_balance < p_amount then
      raise exception 'insufficient available balance' using errcode = 'P0002';
    end if;
  end if;

  if v_destination.account_type_code = 'bank' and v_destination.bank_subtype = 'credit' then
    select accounts.opening_balance + coalesce(sum(
      case entries.entry_side when 'debit' then entries.account_amount when 'credit' then -entries.account_amount end
    ) filter (where transactions.status = 'posted'), 0::numeric)
    into v_destination_balance
    from public.financial_accounts as accounts
    left join public.transaction_entries as entries
      on entries.account_id = accounts.id and entries.asset_id is null
    left join public.financial_transactions as transactions
      on transactions.id = entries.transaction_id and transactions.user_id = accounts.user_id
    where accounts.id = v_destination.id
    group by accounts.opening_balance;

    if v_destination.credit_card_limit is null
      or v_destination_balance + v_received > v_destination.credit_card_limit then
      raise exception 'destination credit account limit would be exceeded' using errcode = '23514';
    end if;
  end if;

  insert into public.financial_transactions (
    user_id, transaction_type_code, transaction_currency_code, status,
    occurred_at, description, notes, reverses_transaction_id
  ) values (
    v_user_id, 'transfer', v_source.currency_code, 'draft', p_occurred_at,
    'Brokerage cash transfer', nullif(btrim(p_notes), ''), p_reverses_transaction_id
  ) returning * into v_transaction;

  insert into public.transaction_entries (
    transaction_id, user_id, account_id, entry_side, transaction_amount, account_amount, memo
  ) values (
    v_transaction.id, v_user_id, v_destination.id, 'debit', p_amount, v_received,
    'brokerage_cash_transfer_received'
  ), (
    v_transaction.id, v_user_id, v_source.id, 'credit', p_amount, p_amount,
    'brokerage_cash_transfer_sent'
  );

  select * into v_transaction from public.post_transaction(v_transaction.id);
  return jsonb_build_object('transaction', to_jsonb(v_transaction));
end;
$$;

create function public.add_brokerage_cash_transfer(
  p_source_account_id uuid,
  p_destination_account_id uuid,
  p_amount numeric,
  p_received_amount numeric,
  p_occurred_at timestamptz,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.post_brokerage_cash_transfer_internal(
    p_source_account_id, p_destination_account_id, p_amount, p_received_amount,
    p_occurred_at, p_notes, null
  );
end;
$$;

create function public.reverse_brokerage_cash_transfer(
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
  v_source_account_id uuid;
  v_source_amount numeric;
  v_destination_account_id uuid;
  v_destination_amount numeric;
  v_transaction_amount numeric;
  v_entry_count integer;
  v_source public.financial_accounts%rowtype;
  v_destination public.financial_accounts%rowtype;
  v_locked public.financial_accounts%rowtype;
  v_source_balance numeric;
  v_destination_balance numeric;
  v_reversal public.financial_transactions%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_original
  from public.financial_transactions
  where id = p_transaction_id and user_id = v_user_id and status = 'posted'
    and transaction_type_code = 'transfer' and description = 'Brokerage cash transfer'
  for update;
  if not found then
    raise exception 'posted Brokerage cash transfer is not available for reversal' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.financial_transactions where reverses_transaction_id = v_original.id) then
    raise exception 'Brokerage cash transfer has already been reversed' using errcode = '23505';
  end if;

  select count(*) into v_entry_count from public.transaction_entries where transaction_id = v_original.id;
  select account_id, account_amount, transaction_amount
  into v_source_account_id, v_source_amount, v_transaction_amount
  from public.transaction_entries
  where transaction_id = v_original.id and entry_side = 'credit'
    and memo = 'brokerage_cash_transfer_sent';
  select account_id, account_amount
  into v_destination_account_id, v_destination_amount
  from public.transaction_entries
  where transaction_id = v_original.id and entry_side = 'debit'
    and memo = 'brokerage_cash_transfer_received'
    and transaction_amount = v_transaction_amount;

  if v_entry_count <> 2 or v_source_account_id is null or v_destination_account_id is null then
    raise exception 'transaction is not a supported Brokerage cash transfer' using errcode = '22023';
  end if;

  -- Reverse the recorded entries directly. Re-posting this as a new transfer
  -- would incorrectly make the destination-native amount the transaction amount.
  for v_locked in
    select *
    from public.financial_accounts
    where id in (v_source_account_id, v_destination_account_id)
      and user_id = v_user_id
      and is_active
    order by id
    for update
  loop
    if v_locked.id = v_source_account_id then v_source := v_locked; end if;
    if v_locked.id = v_destination_account_id then v_destination := v_locked; end if;
  end loop;

  if v_source.id is null or v_destination.id is null then
    raise exception 'linked active accounts are not available for reversal' using errcode = 'P0002';
  end if;

  -- The original destination is credited by the reversal and therefore must
  -- retain enough current cash. This calls the locked no-margin helper when it
  -- is Brokerage, including after subsequent cash consumption.
  if v_destination.account_type_code = 'brokerage' then
    perform public.get_brokerage_available_cash(v_destination.id, v_destination_amount, true);
  else
    select accounts.opening_balance + coalesce(sum(
      case entries.entry_side when 'debit' then entries.account_amount when 'credit' then -entries.account_amount end
    ) filter (where transactions.status = 'posted'), 0::numeric)
    into v_destination_balance
    from public.financial_accounts as accounts
    left join public.transaction_entries as entries
      on entries.account_id = accounts.id and entries.asset_id is null
    left join public.financial_transactions as transactions
      on transactions.id = entries.transaction_id and transactions.user_id = accounts.user_id
    where accounts.id = v_destination.id
    group by accounts.opening_balance;
    if v_destination_balance < v_destination_amount then
      raise exception 'insufficient available balance to reverse Brokerage cash transfer' using errcode = 'P0002';
    end if;
  end if;

  -- The original source is debited by the reversal. A Bank Credit account may
  -- not be restored beyond its available-credit limit after intervening activity.
  if v_source.account_type_code = 'bank' and v_source.bank_subtype = 'credit' then
    select accounts.opening_balance + coalesce(sum(
      case entries.entry_side when 'debit' then entries.account_amount when 'credit' then -entries.account_amount end
    ) filter (where transactions.status = 'posted'), 0::numeric)
    into v_source_balance
    from public.financial_accounts as accounts
    left join public.transaction_entries as entries
      on entries.account_id = accounts.id and entries.asset_id is null
    left join public.financial_transactions as transactions
      on transactions.id = entries.transaction_id and transactions.user_id = accounts.user_id
    where accounts.id = v_source.id
    group by accounts.opening_balance;
    if v_source.credit_card_limit is null
      or v_source_balance + v_source_amount > v_source.credit_card_limit then
      raise exception 'source credit account limit would be exceeded by reversal' using errcode = '23514';
    end if;
  end if;

  insert into public.financial_transactions (
    user_id, transaction_type_code, transaction_currency_code, status,
    occurred_at, description, notes, reverses_transaction_id
  ) values (
    v_user_id, 'transfer', v_original.transaction_currency_code, 'draft', now(),
    'Reversal of Brokerage cash transfer', 'Reversal of ' || v_original.id,
    v_original.id
  ) returning * into v_reversal;

  insert into public.transaction_entries (
    transaction_id, user_id, account_id, entry_side, transaction_amount, account_amount, memo
  ) values (
    v_reversal.id, v_user_id, v_source.id, 'debit', v_transaction_amount, v_source_amount,
    'brokerage_cash_transfer_received'
  ), (
    v_reversal.id, v_user_id, v_destination.id, 'credit', v_transaction_amount, v_destination_amount,
    'brokerage_cash_transfer_sent'
  );

  select * into v_reversal from public.post_transaction(v_reversal.id);
  return jsonb_build_object('transaction', to_jsonb(v_reversal));
end;
$$;

revoke all on function public.post_brokerage_cash_transfer_internal(uuid, uuid, numeric, numeric, timestamptz, text, uuid)
  from public, anon, authenticated;
revoke all on function public.add_brokerage_cash_transfer(uuid, uuid, numeric, numeric, timestamptz, text)
  from public, anon;
revoke all on function public.reverse_brokerage_cash_transfer(uuid)
  from public, anon;
grant execute on function public.add_brokerage_cash_transfer(uuid, uuid, numeric, numeric, timestamptz, text)
  to authenticated;
grant execute on function public.reverse_brokerage_cash_transfer(uuid)
  to authenticated;
