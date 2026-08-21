-- Shared internal posting path for immutable Cash/Bank account records.
-- The public add_account_record signature remains unchanged for existing clients.

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
      v_transaction.id, v_user_id, v_counterparty.id, 'debit', p_amount, v_received, 'transfer_received'
    ), (
      v_transaction.id, v_user_id, v_account.id, 'credit', p_amount, p_amount, 'transfer_sent'
    );
  end if;

  select * into v_transaction from public.post_transaction(v_transaction.id);
  return jsonb_build_object('transaction', to_jsonb(v_transaction));
end;
$$;

create or replace function public.add_account_record(
  p_record_type text,
  p_account_id uuid,
  p_counterparty_account_id uuid,
  p_amount numeric,
  p_received_amount numeric,
  p_occurred_at timestamptz,
  p_category text,
  p_notes text,
  p_main_category_id uuid default null,
  p_subcategory_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_category_label text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_record_type = 'transfer' then
    if p_main_category_id is not null or p_subcategory_id is not null then
      raise exception 'transfers cannot have categories' using errcode = '22023';
    end if;
  else
    if (p_main_category_id is null) <> (p_subcategory_id is null) then
      raise exception 'a visible main category and subcategory are required' using errcode = '22023';
    end if;
    if p_main_category_id is not null then
      v_category_label := public.assert_visible_record_category_selection(
        v_user_id,
        p_main_category_id,
        p_subcategory_id
      );
    elsif nullif(btrim(p_category), '') is null then
      raise exception 'a visible main category and subcategory are required' using errcode = '22023';
    end if;
  end if;

  return public.post_account_record_internal(
    p_record_type,
    p_account_id,
    p_counterparty_account_id,
    p_amount,
    p_received_amount,
    p_occurred_at,
    coalesce(v_category_label, p_category),
    p_notes,
    p_main_category_id,
    p_subcategory_id,
    null,
    null
  );
end;
$$;

-- Retain the older internal signature for already-installed SQL callers while
-- routing all posting through the same shared helper.
create or replace function public.add_account_record_linked(
  p_record_type text,
  p_account_id uuid,
  p_counterparty_account_id uuid,
  p_amount numeric,
  p_received_amount numeric,
  p_occurred_at timestamptz,
  p_category text,
  p_notes text,
  p_main_category_id uuid,
  p_subcategory_id uuid
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
    null,
    null
  );
$$;

revoke all on function public.post_account_record_internal(
  text, uuid, uuid, numeric, numeric, timestamptz, text, text, uuid, uuid, uuid, uuid
) from public, anon, authenticated;
revoke all on function public.add_account_record_linked(
  text, uuid, uuid, numeric, numeric, timestamptz, text, text, uuid, uuid
) from public, anon, authenticated;
revoke all on function public.add_account_record(
  text, uuid, uuid, numeric, numeric, timestamptz, text, text, uuid, uuid
) from public, anon;
grant execute on function public.add_account_record(
  text, uuid, uuid, numeric, numeric, timestamptz, text, text, uuid, uuid
) to authenticated;

comment on function public.post_account_record_internal(
  text, uuid, uuid, numeric, numeric, timestamptz, text, text, uuid, uuid, uuid, uuid
) is 'Internal immutable account-record posting helper. Access is limited to security-definer account-record RPCs.';
