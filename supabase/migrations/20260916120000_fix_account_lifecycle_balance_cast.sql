-- Keep lifecycle balance parsing explicit and fail closed when the text balance
-- read model does not provide a finite decimal value.

create or replace function public.get_account_lifecycle_state(p_account_id uuid)
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
  v_current_value_text text;
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
    select balances.current_balance into v_current_value_text
    from public.get_account_balances(array[p_account_id]) as balances;

    if v_current_value_text is null
      or btrim(v_current_value_text) !~ '^[+-]?[0-9]+([.][0-9]+)?$' then
      v_close_reason := 'current_value_unavailable';
    else
      v_current_value := v_current_value_text::numeric;

      if v_account.account_type_code = 'bank' and v_account.bank_subtype = 'credit' then
        if v_account.credit_card_limit is null then
          v_close_reason := 'current_value_unavailable';
        elsif v_account.credit_card_limit - v_current_value <> 0 then
          v_close_reason := 'outstanding_credit_balance';
        end if;
      elsif v_current_value <> 0 then
        v_close_reason := 'remaining_cash';
      end if;
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

comment on function public.get_account_lifecycle_state(uuid) is
  'Private lifecycle helper. Parses the text balance read model as an explicit finite decimal and fails closed when unavailable.';
