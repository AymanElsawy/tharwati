-- Server-authoritative account close, reopen, and pristine-delete lifecycle.

create function public.get_account_lifecycle_state(p_account_id uuid)
returns table (
  can_close boolean,
  close_block_reason text,
  can_delete boolean,
  delete_block_reason text,
  has_financial_history boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_account public.financial_accounts%rowtype;
  v_current_value numeric;
  v_has_history boolean;
  v_has_positive_holdings boolean;
  v_remaining_grams numeric;
  v_close_reason text;
  v_delete_reason text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_account
  from public.financial_accounts
  where id = p_account_id and user_id = v_user_id;

  if not found then
    raise exception 'account not found' using errcode = 'P0002';
  end if;

  select exists (
    select 1 from public.transaction_entries where account_id = p_account_id
    union all select 1 from public.holdings where account_id = p_account_id
    union all select 1 from public.metal_purchases where account_id = p_account_id
    union all select 1 from public.metal_purchases where funding_account_id = p_account_id
    union all select 1 from public.account_valuations where account_id = p_account_id
    union all select 1 from public.account_disposals where account_id = p_account_id
  ) into v_has_history;

  if v_account.closed_reason = 'sold' then
    v_close_reason := 'sold_account';
  elsif not v_account.is_active then
    v_close_reason := 'already_closed';
  elsif v_account.account_type_code in ('real_estate', 'business') then
    v_close_reason := 'ownership_still_held';
  elsif v_account.account_type_code in ('cash', 'bank', 'brokerage') then
    select balances.current_balance into v_current_value
    from public.get_account_balances(array[p_account_id]) as balances;

    if v_current_value is null then
      v_close_reason := 'current_value_unavailable';
    elsif v_account.account_type_code = 'bank' and v_account.bank_subtype = 'credit' then
      if v_account.credit_card_limit is null then
        v_close_reason := 'current_value_unavailable';
      elsif v_account.credit_card_limit - v_current_value <> 0 then
        v_close_reason := 'outstanding_credit_balance';
      end if;
    elsif v_current_value <> 0 then
      v_close_reason := 'remaining_cash';
    end if;

    if v_close_reason is null and v_account.account_type_code = 'brokerage' then
      select exists (
        select 1 from public.holdings
        where account_id = p_account_id and user_id = v_user_id and quantity > 0
      ) into v_has_positive_holdings;
      if v_has_positive_holdings then v_close_reason := 'remaining_holdings'; end if;
    end if;
  elsif v_account.account_type_code = 'gold' then
    select coalesce(sum(p.quantity_grams), 0) into v_remaining_grams
    from public.get_effective_metal_purchases(array[p_account_id]) as p;
    if v_remaining_grams <> 0 then v_close_reason := 'remaining_metal_quantity'; end if;
  elsif v_account.account_type_code = 'other' and v_account.opening_balance <> 0 then
    v_close_reason := 'remaining_value';
  end if;

  if v_has_history then
    v_delete_reason := 'financial_history';
  elsif v_account.closed_reason = 'sold' then
    v_delete_reason := 'sold_account';
  elsif v_account.account_type_code in ('real_estate', 'business')
    and coalesce(v_account.ownership_percentage, 0) <> 0 then
    v_delete_reason := 'ownership_still_held';
  elsif v_account.account_type_code = 'bank' and v_account.bank_subtype = 'credit' then
    if v_account.credit_card_limit is null
      or v_account.credit_card_limit - v_account.opening_balance <> 0 then
      v_delete_reason := case when v_account.credit_card_limit is null
        then 'current_value_unavailable' else 'outstanding_credit_balance' end;
    end if;
  elsif v_account.account_type_code in ('cash', 'bank', 'brokerage', 'other')
    and v_account.opening_balance <> 0 then
    v_delete_reason := case when v_account.account_type_code = 'other'
      then 'remaining_value' else 'remaining_cash' end;
  elsif v_account.account_type_code = 'gold' and coalesce(v_account.balance_grams, 0) <> 0 then
    v_delete_reason := 'remaining_metal_quantity';
  end if;

  return query select
    v_close_reason is null,
    v_close_reason,
    v_delete_reason is null,
    v_delete_reason,
    v_has_history;
end;
$$;

create function public.get_account_lifecycle_eligibility(p_account_ids uuid[] default null)
returns table (
  account_id uuid,
  can_close boolean,
  close_block_reason text,
  can_delete boolean,
  delete_block_reason text,
  has_financial_history boolean
)
language sql
security definer
set search_path = ''
as $$
  select a.id, s.can_close, s.close_block_reason, s.can_delete,
    s.delete_block_reason, s.has_financial_history
  from public.financial_accounts a
  cross join lateral public.get_account_lifecycle_state(a.id) s
  where a.user_id = auth.uid()
    and (p_account_ids is null or a.id = any(p_account_ids));
$$;

create function public.close_financial_account(p_account_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_state record;
begin
  perform 1 from public.financial_accounts
  where id = p_account_id and user_id = auth.uid() for update;
  if not found then raise exception 'account not found' using errcode = 'P0002'; end if;

  select * into v_state from public.get_account_lifecycle_state(p_account_id);
  if not v_state.can_close then
    raise exception 'account_close_blocked:%', v_state.close_block_reason using errcode = '23514';
  end if;

  perform pg_catalog.set_config('tharwati.account_lifecycle_rpc', 'on', true);
  update public.financial_accounts set is_active = false where id = p_account_id;
  return p_account_id;
end;
$$;

create function public.reopen_financial_account(p_account_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_account public.financial_accounts%rowtype;
begin
  select * into v_account from public.financial_accounts
  where id = p_account_id and user_id = auth.uid() for update;
  if not found then raise exception 'account not found' using errcode = 'P0002'; end if;
  if v_account.closed_reason = 'sold' then
    raise exception 'account_reopen_blocked:sold_account' using errcode = '23514';
  end if;
  perform pg_catalog.set_config('tharwati.account_lifecycle_rpc', 'on', true);
  update public.financial_accounts set is_active = true where id = p_account_id;
  return p_account_id;
end;
$$;

create function public.delete_pristine_financial_account(p_account_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_state record;
begin
  perform 1 from public.financial_accounts
  where id = p_account_id and user_id = auth.uid() for update;
  if not found then raise exception 'account not found' using errcode = 'P0002'; end if;

  select * into v_state from public.get_account_lifecycle_state(p_account_id);
  if not v_state.can_delete then
    raise exception 'account_delete_blocked:%', v_state.delete_block_reason using errcode = '23514';
  end if;

  delete from public.financial_accounts where id = p_account_id and user_id = auth.uid();
  return p_account_id;
end;
$$;

create function public.prevent_direct_account_lifecycle_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_active is distinct from old.is_active
    and current_setting('tharwati.account_lifecycle_rpc', true) is distinct from 'on'
    and current_setting('tharwati.disposal_projection', true) is distinct from 'on' then
    raise exception 'account lifecycle changes must use the close/reopen RPCs' using errcode = '42501';
  end if;
  if (new.closed_reason is distinct from old.closed_reason
      or new.closed_on is distinct from old.closed_on)
    and current_setting('tharwati.disposal_projection', true) is distinct from 'on' then
    raise exception 'account sale status is derived from disposal history' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger financial_accounts_15_prevent_direct_lifecycle_change
before update of is_active, closed_reason, closed_on on public.financial_accounts
for each row execute function public.prevent_direct_account_lifecycle_change();

drop policy if exists financial_accounts_delete_own on public.financial_accounts;
revoke delete on public.financial_accounts from authenticated;

revoke all on function public.get_account_lifecycle_state(uuid) from public, anon, authenticated;
revoke all on function public.get_account_lifecycle_eligibility(uuid[]) from public, anon;
revoke all on function public.close_financial_account(uuid) from public, anon;
revoke all on function public.reopen_financial_account(uuid) from public, anon;
revoke all on function public.delete_pristine_financial_account(uuid) from public, anon;
revoke all on function public.prevent_direct_account_lifecycle_change() from public, anon, authenticated;

grant execute on function public.get_account_lifecycle_eligibility(uuid[]) to authenticated;
grant execute on function public.close_financial_account(uuid) to authenticated;
grant execute on function public.reopen_financial_account(uuid) to authenticated;
grant execute on function public.delete_pristine_financial_account(uuid) to authenticated;

comment on function public.close_financial_account(uuid) is
  'Closes an owned account only after server-authoritative zero-exposure validation.';
comment on function public.delete_pristine_financial_account(uuid) is
  'Hard-deletes only an owned, zero-exposure account with no dependent financial history.';
