alter table public.transaction_entries
  drop constraint transaction_entries_accountless_owner_contribution_check;

alter table public.transaction_entries
  add constraint transaction_entries_accountless_external_flow_check check (
    account_id is not null
    or (
      memo in ('owner_contribution', 'owner_draw')
      and asset_id is null
      and quantity_delta is null
      and unit_price is null
      and purity is null
    )
  );

create or replace function public.add_account_record(
  p_record_type text,
  p_account_id uuid,
  p_counterparty_account_id uuid,
  p_amount numeric,
  p_received_amount numeric,
  p_occurred_at timestamptz,
  p_category text,
  p_notes text
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
  where id = p_account_id and user_id = v_user_id and is_active
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
    where id = p_counterparty_account_id and user_id = v_user_id and is_active
      and account_type_code in ('cash', 'bank')
    for update;
    if not found then
      raise exception 'destination account is not available' using errcode = '42501';
    end if;
    v_received := case when v_account.currency_code = v_counterparty.currency_code
      then p_amount else p_received_amount end;
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
    and v_account.account_type_code = 'bank' and v_account.bank_subtype = 'credit' then
    if v_account.credit_card_limit is null then
      raise exception 'credit account requires a credit card limit before available credit can increase'
        using errcode = '23514';
    end if;
    if v_account_balance + p_amount > v_account.credit_card_limit then
      raise exception 'available credit would exceed its credit limit' using errcode = '23514';
    end if;
  end if;

  insert into public.financial_transactions (
    user_id, transaction_type_code, transaction_currency_code, status,
    occurred_at, description, notes
  ) values (
    v_user_id, p_record_type, v_account.currency_code, 'draft', p_occurred_at,
    case p_record_type when 'transfer' then 'Account transfer' else initcap(p_record_type) || ': ' || btrim(p_category) end,
    nullif(btrim(p_notes), '')
  ) returning * into v_transaction;

  if p_record_type = 'income' then
    insert into public.transaction_entries (transaction_id,user_id,account_id,entry_side,transaction_amount,account_amount,memo)
    values (v_transaction.id,v_user_id,v_account.id,'debit',p_amount,p_amount,btrim(p_category)),
           (v_transaction.id,v_user_id,null,'credit',p_amount,p_amount,'owner_contribution');
  elsif p_record_type = 'expense' then
    insert into public.transaction_entries (transaction_id,user_id,account_id,entry_side,transaction_amount,account_amount,memo)
    values (v_transaction.id,v_user_id,null,'debit',p_amount,p_amount,'owner_draw'),
           (v_transaction.id,v_user_id,v_account.id,'credit',p_amount,p_amount,btrim(p_category));
  else
    -- transaction_amount is the shared source-currency ledger value and stays
    -- exactly balanced. account_amount is native to each referenced account,
    -- preserving the approved received amount without publishing an FX rate.
    insert into public.transaction_entries (
      transaction_id,user_id,account_id,entry_side,
      transaction_amount,account_amount,memo
    ) values (
      v_transaction.id,v_user_id,v_counterparty.id,'debit',
      p_amount,v_received,'transfer_received'
    ), (
      v_transaction.id,v_user_id,v_account.id,'credit',
      p_amount,p_amount,'transfer_sent'
    );
  end if;

  select * into v_transaction from public.post_transaction(v_transaction.id);
  return jsonb_build_object('transaction', to_jsonb(v_transaction));
end;
$$;

revoke all on function public.add_account_record(text,uuid,uuid,numeric,numeric,timestamptz,text,text) from public, anon;
grant execute on function public.add_account_record(text,uuid,uuid,numeric,numeric,timestamptz,text,text) to authenticated;

comment on function public.add_account_record(text,uuid,uuid,numeric,numeric,timestamptz,text,text) is
  'Atomically posts income, expense, or owned-account transfer records for active cash and bank accounts.';
