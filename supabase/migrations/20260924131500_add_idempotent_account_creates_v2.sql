-- Slice 3: additive replay-safe entry points. Legacy APIs remain available.
-- Receipt helpers hold a transaction advisory lock through business mutation and receipt insert.

create function private.slice3_valuation_method(p_method text)
returns text language sql immutable set search_path = '' as $$
  with normalized as (
    select nullif(pg_catalog.btrim(p_method, E' \t\n\r\f' || chr(11) || U&'\0085\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000'), '') as method
  )
  select case when method like 'other:%' then 'other:' || pg_catalog.btrim(substring(method from 7), E' \t\n\r\f' || chr(11) || U&'\0085\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000') else method end from normalized;
$$;

-- Preserve the clients' decimal string contract without a fallible post-commit read.
create function private.slice3_account_result(p_account public.financial_accounts)
returns jsonb language sql immutable set search_path = '' as $$
  select pg_catalog.to_jsonb(p_account) || pg_catalog.jsonb_build_object(
    'opening_balance', p_account.opening_balance::text,
    'credit_card_limit', p_account.credit_card_limit::text,
    'balance_grams', p_account.balance_grams::text,
    'cost_per_unit', p_account.cost_per_unit::text,
    'ownership_percentage', p_account.ownership_percentage::text,
    'initial_ownership_percentage', p_account.initial_ownership_percentage::text);
$$;

create function public.add_metal_purchase_v2(p_account_id uuid, p_purity text, p_occurred_at timestamptz, p_quantity_grams numeric, p_cost_per_unit numeric, p_funding_mode text, p_funding_account_id uuid, p_fees numeric, p_idempotency_key uuid, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); op constant text := 'add_metal_purchase_v2'; req jsonb; r jsonb;
begin
  req := pg_catalog.jsonb_build_object(
    'account_id', p_account_id,
    'purity', lower(btrim(p_purity)),
    'occurred_at', pg_catalog.to_char(p_occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'quantity_grams', pg_catalog.trim_scale(p_quantity_grams)::text,
    'cost_per_unit', pg_catalog.trim_scale(p_cost_per_unit)::text,
    'funding_mode', p_funding_mode,
    'funding_account_id', p_funding_account_id,
    'fees', pg_catalog.trim_scale(coalesce(p_fees,0))::text,
    'notes', nullif(pg_catalog.btrim(p_notes), ''));
  r := private.replay_financial_mutation(u,op,p_idempotency_key,req);
  if r is not null then return r; end if;
  select private.slice3_account_result(a) into r from public.add_metal_purchase(p_account_id,p_purity,p_occurred_at,p_quantity_grams,p_cost_per_unit,p_funding_mode,p_funding_account_id,p_fees,p_notes) a;
  return private.store_financial_mutation(u,op,p_idempotency_key,req,r);
end;
$$;

revoke all on function public.add_metal_purchase_v2(uuid,text,timestamptz,numeric,numeric,text,uuid,numeric,uuid,text) from public, anon;
grant execute on function public.add_metal_purchase_v2(uuid,text,timestamptz,numeric,numeric,text,uuid,numeric,uuid,text) to authenticated;

create function public.add_existing_holding_v2(p_account_id uuid, p_asset_id uuid, p_quantity numeric, p_average_cost numeric, p_idempotency_key uuid, p_occurred_at timestamptz default null, p_notes text default null, p_account_fx_rate numeric default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); op constant text := 'add_existing_holding_v2'; req jsonb; r jsonb;
begin
  req := pg_catalog.jsonb_build_object(
    'account_id', p_account_id,
    'asset_id', p_asset_id,
    'quantity', pg_catalog.trim_scale(p_quantity)::text,
    'average_cost', pg_catalog.trim_scale(p_average_cost)::text,
    'account_fx_rate', pg_catalog.trim_scale(p_account_fx_rate)::text,
    'occurred_at', pg_catalog.to_char(p_occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'notes', nullif(pg_catalog.btrim(p_notes), ''));
  r := private.replay_financial_mutation(u,op,p_idempotency_key,req);
  if r is not null then return r; end if;
  r := public.add_existing_holding(p_account_id,p_asset_id,p_quantity,p_average_cost,p_occurred_at,p_notes,p_account_fx_rate);
  return private.store_financial_mutation(u,op,p_idempotency_key,req,r);
end;
$$;

revoke all on function public.add_existing_holding_v2(uuid,uuid,numeric,numeric,uuid,timestamptz,text,numeric) from public, anon;
grant execute on function public.add_existing_holding_v2(uuid,uuid,numeric,numeric,uuid,timestamptz,text,numeric) to authenticated;

create function public.add_account_valuation_v2(p_account_id uuid, p_valuation_amount numeric, p_valued_on date, p_idempotency_key uuid, p_valuation_method text default null, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); op constant text := 'add_account_valuation_v2'; req jsonb; r jsonb;
begin
  req := pg_catalog.jsonb_build_object(
    'account_id', p_account_id,
    'valuation_amount', pg_catalog.trim_scale(p_valuation_amount)::text,
    'valued_on', p_valued_on,
    'valuation_method', private.slice3_valuation_method(p_valuation_method),
    'notes', nullif(pg_catalog.btrim(p_notes), ''));
  r := private.replay_financial_mutation(u,op,p_idempotency_key,req);
  if r is not null then return r; end if;
  select pg_catalog.to_jsonb(v) || pg_catalog.jsonb_build_object('valuation_amount',v.valuation_amount::text) into r from public.add_account_valuation(p_account_id,p_valuation_amount,p_valued_on,p_valuation_method,p_notes) v;
  return private.store_financial_mutation(u,op,p_idempotency_key,req,r);
end;
$$;

revoke all on function public.add_account_valuation_v2(uuid,numeric,date,uuid,text,text) from public, anon;
grant execute on function public.add_account_valuation_v2(uuid,numeric,date,uuid,text,text) to authenticated;

create function public.create_financial_account_v2(p_account_type_code text, p_name text, p_currency_code text, p_idempotency_key uuid, p_opening_balance numeric default 0, p_notes text default null, p_bank_subtype text default null, p_credit_card_limit numeric default null, p_due_day_of_month integer default null, p_investment_type text default null, p_metal_type text default null, p_balance_grams numeric default null, p_purity text default null, p_purchase_date date default null, p_cost_per_unit numeric default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); op constant text := 'create_financial_account_v2'; req jsonb; r jsonb;
begin
  req := pg_catalog.jsonb_build_object(
    'account_type_code', p_account_type_code,
    'name', btrim(p_name),
    'currency_code', p_currency_code,
    'opening_balance', pg_catalog.trim_scale(coalesce(p_opening_balance,0))::text,
    'notes', nullif(pg_catalog.btrim(p_notes), ''),
    'bank_subtype', p_bank_subtype,
    'credit_card_limit', pg_catalog.trim_scale(p_credit_card_limit)::text,
    'due_day_of_month', p_due_day_of_month,
    'investment_type', p_investment_type,
    'metal_type', p_metal_type,
    'balance_grams', pg_catalog.trim_scale(p_balance_grams)::text,
    'purity', p_purity,
    'purchase_date', p_purchase_date,
    'cost_per_unit', pg_catalog.trim_scale(p_cost_per_unit)::text);
  r := private.replay_financial_mutation(u,op,p_idempotency_key,req);
  if r is not null then return r; end if;
  if p_account_type_code is null or p_account_type_code not in ('cash','bank','brokerage','gold','other') then
    raise exception 'ordinary account type required' using errcode='22023';
  end if;
  -- Table constraints/triggers retain type shape, uniqueness and opening balance validation.
  with inserted as (
    insert into public.financial_accounts(user_id,account_type_code,name,currency_code,opening_balance,notes,bank_subtype,credit_card_limit,due_day_of_month,investment_type,metal_type,balance_grams,purity,purchase_date,cost_per_unit)
    values(u,p_account_type_code,btrim(p_name),p_currency_code,coalesce(p_opening_balance,0),nullif(btrim(p_notes),''),p_bank_subtype,p_credit_card_limit,p_due_day_of_month,p_investment_type,p_metal_type,p_balance_grams,p_purity,p_purchase_date,p_cost_per_unit)
    returning *
  ) select private.slice3_account_result(inserted) into r from inserted;
  return private.store_financial_mutation(u,op,p_idempotency_key,req,r);
end;
$$;

revoke all on function public.create_financial_account_v2(text,text,text,uuid,numeric,text,text,numeric,integer,text,text,numeric,text,date,numeric) from public, anon;
grant execute on function public.create_financial_account_v2(text,text,text,uuid,numeric,text,text,numeric,integer,text,text,numeric,text,date,numeric) to authenticated;

create function public.create_valued_account_v2(p_account_type_code text, p_name text, p_currency_code text, p_property_type text, p_business_type text, p_industry text, p_ownership_percentage numeric, p_location text, p_account_notes text, p_valuation_amount numeric, p_valued_on date, p_valuation_method text, p_valuation_notes text, p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); op constant text := 'create_valued_account_v2'; req jsonb; r jsonb;
begin
  req := pg_catalog.jsonb_build_object(
    'account_type_code', p_account_type_code,
    'name', btrim(p_name),
    'currency_code', p_currency_code,
    'property_type', case when p_account_type_code='real_estate' then p_property_type end,
    'business_type', case when p_account_type_code='business' then nullif(pg_catalog.btrim(p_business_type), '') end,
    'industry', case when p_account_type_code='business' then nullif(pg_catalog.btrim(p_industry), '') end,
    'ownership_percentage', pg_catalog.trim_scale(p_ownership_percentage)::text,
    'location', case when p_account_type_code='real_estate' then nullif(pg_catalog.btrim(p_location), '') end,
    'account_notes', nullif(pg_catalog.btrim(p_account_notes), ''),
    'valuation_amount', pg_catalog.trim_scale(p_valuation_amount)::text,
    'valued_on', p_valued_on,
    'valuation_method', private.slice3_valuation_method(p_valuation_method),
    'valuation_notes', nullif(pg_catalog.btrim(p_valuation_notes), ''));
  r := private.replay_financial_mutation(u,op,p_idempotency_key,req);
  if r is not null then return r; end if;
  select private.slice3_account_result(a) into r from public.create_valued_account(p_account_type_code,p_name,p_currency_code,p_property_type,p_business_type,p_industry,p_ownership_percentage,p_location,p_account_notes,p_valuation_amount,p_valued_on,p_valuation_method,p_valuation_notes) a;
  return private.store_financial_mutation(u,op,p_idempotency_key,req,r);
end;
$$;

revoke all on function public.create_valued_account_v2(text,text,text,text,text,text,numeric,text,text,numeric,date,text,text,uuid) from public, anon;
grant execute on function public.create_valued_account_v2(text,text,text,text,text,text,numeric,text,text,numeric,date,text,text,uuid) to authenticated;

revoke all on function private.slice3_valuation_method(text) from public, anon, authenticated;
revoke all on function private.slice3_account_result(public.financial_accounts) from public, anon, authenticated;
