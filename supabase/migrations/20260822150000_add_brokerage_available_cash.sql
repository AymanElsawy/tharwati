-- Brokerage cash remains an account-side projection of the shared ledger.
-- Asset entries are deliberately excluded: holdings have their own projection.
create or replace function public.get_brokerage_available_cash(
  p_account_id uuid,
  p_required_cash numeric default null,
  p_lock_account boolean default false
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_opening_balance numeric;
  v_available_cash numeric;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_required_cash is not null and p_required_cash < 0 then
    raise exception 'required brokerage cash cannot be negative' using errcode = '22023';
  end if;

  if p_lock_account then
    select accounts.opening_balance into v_opening_balance
    from public.financial_accounts as accounts
    where accounts.id = p_account_id and accounts.user_id = v_user_id
      and accounts.is_active and accounts.account_type_code = 'brokerage'
    for update;
  else
    select accounts.opening_balance into v_opening_balance
    from public.financial_accounts as accounts
    where accounts.id = p_account_id and accounts.user_id = v_user_id
      and accounts.is_active and accounts.account_type_code = 'brokerage';
  end if;

  if not found then
    raise exception 'owned active brokerage account is not available' using errcode = '42501';
  end if;

  select v_opening_balance + coalesce(sum(
    case entries.entry_side when 'debit' then entries.account_amount when 'credit' then -entries.account_amount end
  ) filter (where transactions.status = 'posted'), 0::numeric)
  into v_available_cash
  from public.transaction_entries as entries
  join public.financial_transactions as transactions
    on transactions.id = entries.transaction_id and transactions.user_id = v_user_id
  where entries.account_id = p_account_id and entries.asset_id is null;

  if p_required_cash is not null and v_available_cash < p_required_cash then
    raise exception 'insufficient brokerage available cash' using errcode = 'P0002';
  end if;
  return v_available_cash;
end;
$$;

comment on function public.get_brokerage_available_cash(uuid, numeric, boolean) is
  'Internal helper for owned active Brokerage cash validation. Returns opening balance plus posted non-asset debit/credit ledger effects; optional required cash rejects a below-zero future balance and optional locking serializes a future posting flow.';

create or replace function public.get_account_balances(
  p_account_ids uuid[] default null
)
returns table (
  account_id uuid,
  account_type_code text,
  account_name text,
  currency_code text,
  is_active boolean,
  opening_balance text,
  ledger_effect text,
  current_balance text
)
language sql
stable
security definer
set search_path = ''
as $$
  select accounts.id, accounts.account_type_code, accounts.name,
    accounts.currency_code, accounts.is_active, accounts.opening_balance::text,
    coalesce(sum(case entries.entry_side
      when 'debit' then entries.account_amount
      when 'credit' then -entries.account_amount end)
      filter (where transactions.status = 'posted'), 0)::text,
    (accounts.opening_balance + coalesce(sum(case entries.entry_side
      when 'debit' then entries.account_amount
      when 'credit' then -entries.account_amount end)
      filter (where transactions.status = 'posted'), 0))::text
  from public.financial_accounts as accounts
  left join public.transaction_entries as entries
    on entries.account_id = accounts.id and entries.asset_id is null
  left join public.financial_transactions as transactions
    on transactions.id = entries.transaction_id
    and transactions.user_id = accounts.user_id
  where accounts.user_id = auth.uid()
    and (accounts.account_type_code in ('cash', 'bank')
      or (accounts.account_type_code = 'brokerage' and accounts.is_active))
    and (p_account_ids is null or accounts.id = any(p_account_ids))
  group by accounts.id;
$$;

revoke all on function public.get_brokerage_available_cash(uuid, numeric, boolean)
  from public, anon, authenticated;
