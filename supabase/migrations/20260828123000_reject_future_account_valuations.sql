-- Current-value valuations cannot take effect before their valuation date.

create or replace function public.add_account_valuation(
  p_account_id uuid, p_valuation_amount numeric, p_valued_on date,
  p_valuation_method text default null, p_notes text default null
)
returns public.account_valuations
language plpgsql security definer set search_path = ''
as $$
declare v_account public.financial_accounts; v_row public.account_valuations;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Authentication is required'; end if;
  select * into v_account from public.financial_accounts
  where id = p_account_id and user_id = auth.uid() and is_active for update;
  if not found or v_account.account_type_code not in ('real_estate', 'business') then
    raise exception using errcode = '23514', message = 'An active owned Real Estate or Business account is required';
  end if;
  if p_valuation_amount is null or p_valuation_amount < 0 or p_valued_on is null or p_valued_on > current_date then
    raise exception using errcode = '23514', message = 'A non-negative non-future valuation amount and valuation date are required';
  end if;
  if v_account.account_type_code <> 'business' and nullif(btrim(coalesce(p_valuation_method, '')), '') is not null then
    raise exception using errcode = '23514', message = 'Valuation method is supported only for Business accounts';
  end if;
  insert into public.account_valuations (user_id, account_id, valuation_amount, valued_on, valuation_method, notes)
  values (auth.uid(), p_account_id, p_valuation_amount, p_valued_on,
    nullif(btrim(p_valuation_method), ''), nullif(btrim(p_notes), '')) returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.correct_account_valuation(
  p_valuation_id uuid, p_valuation_amount numeric, p_valued_on date,
  p_valuation_method text default null, p_notes text default null
)
returns public.account_valuations
language plpgsql security definer set search_path = ''
as $$
declare v_original public.account_valuations; v_account public.financial_accounts; v_row public.account_valuations;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Authentication is required'; end if;
  select * into v_original from public.account_valuations where id = p_valuation_id and user_id = auth.uid() for update;
  if not found or exists (select 1 from public.account_valuations where corrects_valuation_id = p_valuation_id) then
    raise exception using errcode = '23514', message = 'Only an effective owned valuation can be corrected';
  end if;
  select * into v_account from public.financial_accounts where id = v_original.account_id and user_id = auth.uid() for update;
  if not found or v_account.account_type_code not in ('real_estate', 'business') then raise exception using errcode = '23514', message = 'A supported owned account is required'; end if;
  if p_valuation_amount is null or p_valuation_amount < 0 or p_valued_on is null or p_valued_on > current_date then raise exception using errcode = '23514', message = 'A non-negative non-future valuation amount and valuation date are required'; end if;
  if v_account.account_type_code <> 'business' and nullif(btrim(coalesce(p_valuation_method, '')), '') is not null then raise exception using errcode = '23514', message = 'Valuation method is supported only for Business accounts'; end if;
  insert into public.account_valuations (user_id, account_id, valuation_amount, valued_on, valuation_method, notes, corrects_valuation_id)
  values (auth.uid(), v_original.account_id, p_valuation_amount, p_valued_on,
    nullif(btrim(p_valuation_method), ''), nullif(btrim(p_notes), ''), p_valuation_id) returning * into v_row;
  return v_row;
end;
$$;
