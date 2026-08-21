-- Immutable Account Record reversals. The public add RPC remains unchanged.

-- The existing 12-argument helper remains the normal Add Record entry point.
-- This overload additionally accepts the shared transaction amount so a
-- cross-currency transfer can be reversed with both account-native amounts intact.
create or replace function public.post_account_record_internal(
  p_record_type text,
  p_account_id uuid,
  p_counterparty_account_id uuid,
  p_amount numeric,
  p_received_amount numeric,
  p_occurred_at timestamptz,
  p_category text,
  p_notes text,
  p_main_category_id uuid,
  p_subcategory_id uuid,
  p_reverses_transaction_id uuid,
  p_corrects_transaction_id uuid,
  p_transaction_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_account public.financial_accounts%rowtype;
  v_counterparty public.financial_accounts%rowtype;
  v_transaction public.financial_transactions%rowtype;
  v_account_balance numeric;
  v_counterparty_balance numeric;
  v_received numeric;
  v_transaction_amount numeric;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_record_type not in ('income', 'expense', 'transfer') then
    raise exception 'record type must be income, expense, or transfer' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive' using errcode = '22023';
  end if;
  if p_occurred_at is null then
    raise exception 'date and time are required' using errcode = '22023';
  end if;
  if p_record_type <> 'transfer' and nullif(btrim(p_category), '') is null then
    raise exception 'category is required' using errcode = '22023';
  end if;

  select * into v_account
  from public.financial_accounts
  where id = p_account_id
    and user_id = v_user_id
    and is_active
    and account_type_code in ('cash', 'bank')
  for update;
  if not found then
    raise exception 'selected account is not available' using errcode = '42501';
  end if;

  select v_account.opening_balance + coalesce(sum(
    case e.entry_side when 'debit' then e.account_amount else -e.account_amount end
  ) filter (where t.status = 'posted'), 0)
  into v_account_balance
  from public.transaction_entries e
  join public.financial_transactions t on t.id = e.transaction_id
  where e.account_id = v_account.id and e.asset_id is null;

  if p_record_type = 'transfer' then
    if p_counterparty_account_id is null or p_counterparty_account_id = p_account_id then
      raise exception 'from and to accounts must be different' using errcode = '22023';
    end if;

    select * into v_counterparty
    from public.financial_accounts
    where id = p_counterparty_account_id
      and user_id = v_user_id
      and is_active
      and account_type_code in ('cash', 'bank')
    for update;
    if not found then
      raise exception 'destination account is not available' using errcode = '42501';
    end if;

    v_received := case
      when v_account.currency_code = v_counterparty.currency_code then p_amount
      else p_received_amount
    end;
    if v_received is null or v_received <= 0 then
      raise exception 'received amount must be positive' using errcode = '22023';
    end if;
    v_transaction_amount := coalesce(p_transaction_amount, p_amount);
    if v_transaction_amount <= 0 then
      raise exception 'transaction amount must be positive' using errcode = '22023';
    end if;
    if v_account_balance < p_amount then
      raise exception 'insufficient available balance' using errcode = 'P0002';
    end if;

    select v_counterparty.opening_balance + coalesce(sum(
      case e.entry_side when 'debit' then e.account_amount else -e.account_amount end
    ) filter (where t.status = 'posted'), 0)
    into v_counterparty_balance
    from public.transaction_entries e
    join public.financial_transactions t on t.id = e.transaction_id
    where e.account_id = v_counterparty.id and e.asset_id is null;

    if v_counterparty.account_type_code = 'bank' and v_counterparty.bank_subtype = 'credit' then
      if v_counterparty.credit_card_limit is null then
        raise exception 'destination credit account requires a credit card limit before available credit can increase'
          using errcode = '23514';
      end if;
      if v_counterparty_balance + v_received > v_counterparty.credit_card_limit then
        raise exception 'destination available credit would exceed its credit limit' using errcode = '23514';
      end if;
    end if;
  elsif p_record_type = 'expense' and v_account_balance < p_amount then
    raise exception 'insufficient available balance' using errcode = 'P0002';
  elsif p_record_type = 'income'
    and v_account.account_type_code = 'bank'
    and v_account.bank_subtype = 'credit' then
    if v_account.credit_card_limit is null then
      raise exception 'credit account requires a credit card limit before available credit can increase'
        using errcode = '23514';
    end if;
    if v_account_balance + p_amount > v_account.credit_card_limit then
      raise exception 'available credit would exceed its credit limit' using errcode = '23514';
    end if;
  end if;

  insert into public.financial_transactions (
    user_id,
    transaction_type_code,
    transaction_currency_code,
    status,
    occurred_at,
    description,
    notes,
    main_category_id,
    subcategory_id,
    reverses_transaction_id,
    corrects_transaction_id
  ) values (
    v_user_id,
    p_record_type,
    v_account.currency_code,
    'draft',
    p_occurred_at,
    case p_record_type
      when 'transfer' then 'Account transfer'
      else initcap(p_record_type) || ': ' || btrim(p_category)
    end,
    nullif(btrim(p_notes), ''),
    p_main_category_id,
    p_subcategory_id,
    p_reverses_transaction_id,
    p_corrects_transaction_id
  )
  returning * into v_transaction;

  if p_record_type = 'income' then
    insert into public.transaction_entries (
      transaction_id, user_id, account_id, entry_side, transaction_amount, account_amount, memo
    ) values (
      v_transaction.id, v_user_id, v_account.id, 'debit', p_amount, p_amount, btrim(p_category)
    ), (
      v_transaction.id, v_user_id, null, 'credit', p_amount, p_amount, 'owner_contribution'
    );
  elsif p_record_type = 'expense' then
    insert into public.transaction_entries (
      transaction_id, user_id, account_id, entry_side, transaction_amount, account_amount, memo
    ) values (
      v_transaction.id, v_user_id, null, 'debit', p_amount, p_amount, 'owner_draw'
    ), (
      v_transaction.id, v_user_id, v_account.id, 'credit', p_amount, p_amount, btrim(p_category)
    );
  else
    insert into public.transaction_entries (
      transaction_id, user_id, account_id, entry_side, transaction_amount, account_amount, memo
    ) values (
      v_transaction.id, v_user_id, v_counterparty.id, 'debit', v_transaction_amount, v_received, 'transfer_received'
    ), (
      v_transaction.id, v_user_id, v_account.id, 'credit', v_transaction_amount, p_amount, 'transfer_sent'
    );
  end if;

  select * into v_transaction from public.post_transaction(v_transaction.id);
  return jsonb_build_object('transaction', to_jsonb(v_transaction));
end;
$$;

create or replace function public.post_account_record_internal(
  p_record_type text,
  p_account_id uuid,
  p_counterparty_account_id uuid,
  p_amount numeric,
  p_received_amount numeric,
  p_occurred_at timestamptz,
  p_category text,
  p_notes text,
  p_main_category_id uuid,
  p_subcategory_id uuid,
  p_reverses_transaction_id uuid default null,
  p_corrects_transaction_id uuid default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.post_account_record_internal(
    p_record_type,
    p_account_id,
    p_counterparty_account_id,
    p_amount,
    p_received_amount,
    p_occurred_at,
    p_category,
    p_notes,
    p_main_category_id,
    p_subcategory_id,
    p_reverses_transaction_id,
    p_corrects_transaction_id,
    null
  );
$$;

create or replace function public.reverse_account_record(
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
  v_entry_count integer;
  v_account_id uuid;
  v_account_amount numeric;
  v_category text;
  v_source_account_id uuid;
  v_source_account_amount numeric;
  v_destination_account_id uuid;
  v_destination_account_amount numeric;
  v_transfer_transaction_amount numeric;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_original
  from public.financial_transactions
  where id = p_transaction_id
    and user_id = v_user_id
    and status = 'posted'
    and transaction_type_code in ('income', 'expense', 'transfer')
  for update;
  if not found then
    raise exception 'posted account record is not available for reversal' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.financial_transactions
    where reverses_transaction_id = v_original.id
  ) then
    raise exception 'account record has already been reversed' using errcode = '23505';
  end if;

  select count(*) into v_entry_count
  from public.transaction_entries
  where transaction_id = v_original.id;

  if v_original.transaction_type_code = 'income' then
    select e.account_id, e.account_amount, e.memo
    into v_account_id, v_account_amount, v_category
    from public.transaction_entries e
    where e.transaction_id = v_original.id
      and e.account_id is not null
      and e.entry_side = 'debit';

    if v_entry_count <> 2 or not found or not exists (
      select 1
      from public.transaction_entries e
      where e.transaction_id = v_original.id
        and e.account_id is null
        and e.entry_side = 'credit'
        and e.memo = 'owner_contribution'
    ) then
      raise exception 'transaction is not a supported income record' using errcode = '22023';
    end if;

    return public.post_account_record_internal(
      'expense', v_account_id, null, v_account_amount, null, now(), v_category,
      'Reversal of ' || v_original.id, v_original.main_category_id, v_original.subcategory_id,
      v_original.id, null
    );
  end if;

  if v_original.transaction_type_code = 'expense' then
    select e.account_id, e.account_amount, e.memo
    into v_account_id, v_account_amount, v_category
    from public.transaction_entries e
    where e.transaction_id = v_original.id
      and e.account_id is not null
      and e.entry_side = 'credit';

    if v_entry_count <> 2 or not found or not exists (
      select 1
      from public.transaction_entries e
      where e.transaction_id = v_original.id
        and e.account_id is null
        and e.entry_side = 'debit'
        and e.memo = 'owner_draw'
    ) then
      raise exception 'transaction is not a supported expense record' using errcode = '22023';
    end if;

    return public.post_account_record_internal(
      'income', v_account_id, null, v_account_amount, null, now(), v_category,
      'Reversal of ' || v_original.id, v_original.main_category_id, v_original.subcategory_id,
      v_original.id, null
    );
  end if;

  select e.account_id, e.account_amount, e.transaction_amount
  into v_source_account_id, v_source_account_amount, v_transfer_transaction_amount
  from public.transaction_entries e
  where e.transaction_id = v_original.id
    and e.account_id is not null
    and e.entry_side = 'credit'
    and e.memo = 'transfer_sent';

  if not found then
    raise exception 'transaction is not a supported transfer record' using errcode = '22023';
  end if;

  select e.account_id, e.account_amount
  into v_destination_account_id, v_destination_account_amount
  from public.transaction_entries e
  where e.transaction_id = v_original.id
    and e.account_id is not null
    and e.entry_side = 'debit'
    and e.memo = 'transfer_received'
    and e.transaction_amount = v_transfer_transaction_amount;

  if v_entry_count <> 2 or not found or v_source_account_id = v_destination_account_id then
    raise exception 'transaction is not a supported transfer record' using errcode = '22023';
  end if;

  return public.post_account_record_internal(
    'transfer',
    v_destination_account_id,
    v_source_account_id,
    v_destination_account_amount,
    v_source_account_amount,
    now(),
    null,
    'Reversal of ' || v_original.id,
    null,
    null,
    v_original.id,
    null,
    v_transfer_transaction_amount
  );
end;
$$;

revoke all on function public.post_account_record_internal(
  text, uuid, uuid, numeric, numeric, timestamptz, text, text, uuid, uuid, uuid, uuid
) from public, anon, authenticated;
revoke all on function public.post_account_record_internal(
  text, uuid, uuid, numeric, numeric, timestamptz, text, text, uuid, uuid, uuid, uuid, numeric
) from public, anon, authenticated;
revoke all on function public.reverse_account_record(uuid) from public, anon;
grant execute on function public.reverse_account_record(uuid) to authenticated;

comment on function public.reverse_account_record(uuid) is
  'Atomically posts an immutable exact-opposite reversal for an owned posted Account Record.';
