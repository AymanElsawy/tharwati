comment on table private.account_record_mutation_receipts is
  'Server-private receipts for replay-safe financial mutations. Clients have no direct access.';

create function private.replay_financial_mutation(
  p_user_id uuid, p_operation text, p_idempotency_key uuid, p_request jsonb
) returns jsonb language plpgsql set search_path = '' as $$
declare v_hash text; v_receipt private.account_record_mutation_receipts%rowtype;
begin
  if p_user_id is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_idempotency_key is null then raise exception 'idempotency key is required' using errcode='22023'; end if;
  v_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(p_request::text,'UTF8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text||':'||p_operation||':'||p_idempotency_key::text,0));
  select * into v_receipt from private.account_record_mutation_receipts
   where user_id=p_user_id and operation=p_operation and idempotency_key=p_idempotency_key for update;
  if not found then return null; end if;
  if v_receipt.request_hash<>v_hash then
    raise exception 'idempotency key was already used with a different request' using errcode='22023';
  end if;
  return v_receipt.result||pg_catalog.jsonb_build_object('replayed',true);
end $$;

create function private.store_financial_mutation(
  p_user_id uuid, p_operation text, p_idempotency_key uuid, p_request jsonb, p_result jsonb
) returns jsonb language plpgsql set search_path = '' as $$
begin
  insert into private.account_record_mutation_receipts(user_id,operation,idempotency_key,request_hash,result)
  values(p_user_id,p_operation,p_idempotency_key,
    pg_catalog.encode(extensions.digest(pg_catalog.convert_to(p_request::text,'UTF8'),'sha256'),'hex'),p_result);
  return p_result||pg_catalog.jsonb_build_object('replayed',false);
end $$;

revoke all on function private.replay_financial_mutation(uuid,text,uuid,jsonb) from public,anon,authenticated;
revoke all on function private.store_financial_mutation(uuid,text,uuid,jsonb,jsonb) from public,anon,authenticated;

create function public.add_brokerage_buy_v2(
 p_account_id uuid,p_asset_id uuid,p_quantity numeric,p_unit_price numeric,p_idempotency_key uuid,
 p_occurred_at timestamptz default null,p_notes text default null,p_fees numeric default 0,p_account_fx_rate numeric default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); op constant text:='add_brokerage_buy_v2'; req jsonb; r jsonb;
begin
 req:=pg_catalog.jsonb_build_object('account_id',p_account_id,'asset_id',p_asset_id,'quantity',case when p_quantity is null then null else pg_catalog.trim_scale(p_quantity)::text end,'unit_price',case when p_unit_price is null then null else pg_catalog.trim_scale(p_unit_price)::text end,'occurred_at',case when p_occurred_at is null then null else pg_catalog.to_char(p_occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end,'notes',nullif(pg_catalog.btrim(p_notes),''),'fees',pg_catalog.trim_scale(coalesce(p_fees,0))::text,'account_fx_rate',case when p_account_fx_rate is null then null else pg_catalog.trim_scale(p_account_fx_rate)::text end);
 r:=private.replay_financial_mutation(u,op,p_idempotency_key,req); if r is not null then return r; end if;
 r:=public.add_brokerage_buy(p_account_id,p_asset_id,p_quantity,p_unit_price,p_occurred_at,p_notes,p_fees,p_account_fx_rate);
 return private.store_financial_mutation(u,op,p_idempotency_key,req,r);
end $$;

create function public.add_brokerage_sell_v2(
 p_account_id uuid,p_asset_id uuid,p_quantity numeric,p_unit_sale_price numeric,p_idempotency_key uuid,
 p_occurred_at timestamptz default null,p_notes text default null,p_fees numeric default 0,p_account_fx_rate numeric default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); op constant text:='add_brokerage_sell_v2'; req jsonb; r jsonb;
begin
 req:=pg_catalog.jsonb_build_object('account_id',p_account_id,'asset_id',p_asset_id,'quantity',case when p_quantity is null then null else pg_catalog.trim_scale(p_quantity)::text end,'unit_sale_price',case when p_unit_sale_price is null then null else pg_catalog.trim_scale(p_unit_sale_price)::text end,'occurred_at',case when p_occurred_at is null then null else pg_catalog.to_char(p_occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end,'notes',nullif(pg_catalog.btrim(p_notes),''),'fees',pg_catalog.trim_scale(coalesce(p_fees,0))::text,'account_fx_rate',case when p_account_fx_rate is null then null else pg_catalog.trim_scale(p_account_fx_rate)::text end);
 r:=private.replay_financial_mutation(u,op,p_idempotency_key,req); if r is not null then return r; end if;
 r:=public.add_brokerage_sell(p_account_id,p_asset_id,p_quantity,p_unit_sale_price,p_occurred_at,p_notes,p_fees,p_account_fx_rate);
 return private.store_financial_mutation(u,op,p_idempotency_key,req,r);
end $$;

create function public.add_brokerage_cash_dividend_v2(
 p_account_id uuid,p_asset_id uuid,p_gross_dividend numeric,p_idempotency_key uuid,
 p_withholding_tax numeric default 0,p_fees numeric default 0,p_occurred_at timestamptz default null,p_notes text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); op constant text:='add_brokerage_cash_dividend_v2'; req jsonb; r jsonb;
begin
 req:=pg_catalog.jsonb_build_object('account_id',p_account_id,'asset_id',p_asset_id,'gross_dividend',case when p_gross_dividend is null then null else pg_catalog.trim_scale(p_gross_dividend)::text end,'withholding_tax',pg_catalog.trim_scale(coalesce(p_withholding_tax,0))::text,'fees',pg_catalog.trim_scale(coalesce(p_fees,0))::text,'occurred_at',case when p_occurred_at is null then null else pg_catalog.to_char(p_occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end,'notes',nullif(pg_catalog.btrim(p_notes),''));
 r:=private.replay_financial_mutation(u,op,p_idempotency_key,req); if r is not null then return r; end if;
 r:=public.add_brokerage_cash_dividend(p_account_id,p_asset_id,p_gross_dividend,p_withholding_tax,p_fees,p_occurred_at,p_notes);
 return private.store_financial_mutation(u,op,p_idempotency_key,req,r);
end $$;

create function public.add_brokerage_dividend_reinvestment_v2(
 p_account_id uuid,p_asset_id uuid,p_gross_dividend numeric,p_unit_price numeric,p_idempotency_key uuid,
 p_withholding_tax numeric default 0,p_fees numeric default 0,p_occurred_at timestamptz default null,p_notes text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); op constant text:='add_brokerage_dividend_reinvestment_v2'; req jsonb; r jsonb;
begin
 req:=pg_catalog.jsonb_build_object('account_id',p_account_id,'asset_id',p_asset_id,'gross_dividend',case when p_gross_dividend is null then null else pg_catalog.trim_scale(p_gross_dividend)::text end,'unit_price',case when p_unit_price is null then null else pg_catalog.trim_scale(p_unit_price)::text end,'withholding_tax',pg_catalog.trim_scale(coalesce(p_withholding_tax,0))::text,'fees',pg_catalog.trim_scale(coalesce(p_fees,0))::text,'occurred_at',case when p_occurred_at is null then null else pg_catalog.to_char(p_occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end,'notes',nullif(pg_catalog.btrim(p_notes),''));
 r:=private.replay_financial_mutation(u,op,p_idempotency_key,req); if r is not null then return r; end if;
 r:=public.add_brokerage_dividend_reinvestment(p_account_id,p_asset_id,p_gross_dividend,p_withholding_tax,p_fees,p_unit_price,p_occurred_at,p_notes);
 return private.store_financial_mutation(u,op,p_idempotency_key,req,r);
end $$;

create function public.add_brokerage_partial_dividend_reinvestment_v2(
 p_account_id uuid,p_asset_id uuid,p_gross_dividend numeric,p_reinvested_amount numeric,p_unit_price numeric,p_idempotency_key uuid,
 p_withholding_tax numeric default 0,p_fees numeric default 0,p_occurred_at timestamptz default null,p_notes text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); op constant text:='add_brokerage_partial_dividend_reinvestment_v2'; req jsonb; r jsonb;
begin
 req:=pg_catalog.jsonb_build_object('account_id',p_account_id,'asset_id',p_asset_id,'gross_dividend',case when p_gross_dividend is null then null else pg_catalog.trim_scale(p_gross_dividend)::text end,'reinvested_amount',case when p_reinvested_amount is null then null else pg_catalog.trim_scale(p_reinvested_amount)::text end,'unit_price',case when p_unit_price is null then null else pg_catalog.trim_scale(p_unit_price)::text end,'withholding_tax',pg_catalog.trim_scale(coalesce(p_withholding_tax,0))::text,'fees',pg_catalog.trim_scale(coalesce(p_fees,0))::text,'occurred_at',case when p_occurred_at is null then null else pg_catalog.to_char(p_occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end,'notes',nullif(pg_catalog.btrim(p_notes),''));
 r:=private.replay_financial_mutation(u,op,p_idempotency_key,req); if r is not null then return r; end if;
 r:=public.add_brokerage_partial_dividend_reinvestment(p_account_id,p_asset_id,p_gross_dividend,p_withholding_tax,p_fees,p_reinvested_amount,p_unit_price,p_occurred_at,p_notes);
 return private.store_financial_mutation(u,op,p_idempotency_key,req,r);
end $$;

revoke all on function public.add_brokerage_buy_v2(uuid,uuid,numeric,numeric,uuid,timestamptz,text,numeric,numeric) from public,anon;
revoke all on function public.add_brokerage_sell_v2(uuid,uuid,numeric,numeric,uuid,timestamptz,text,numeric,numeric) from public,anon;
revoke all on function public.add_brokerage_cash_dividend_v2(uuid,uuid,numeric,uuid,numeric,numeric,timestamptz,text) from public,anon;
revoke all on function public.add_brokerage_dividend_reinvestment_v2(uuid,uuid,numeric,numeric,uuid,numeric,numeric,timestamptz,text) from public,anon;
revoke all on function public.add_brokerage_partial_dividend_reinvestment_v2(uuid,uuid,numeric,numeric,numeric,uuid,numeric,numeric,timestamptz,text) from public,anon;
grant execute on function public.add_brokerage_buy_v2(uuid,uuid,numeric,numeric,uuid,timestamptz,text,numeric,numeric) to authenticated,service_role;
grant execute on function public.add_brokerage_sell_v2(uuid,uuid,numeric,numeric,uuid,timestamptz,text,numeric,numeric) to authenticated,service_role;
grant execute on function public.add_brokerage_cash_dividend_v2(uuid,uuid,numeric,uuid,numeric,numeric,timestamptz,text) to authenticated,service_role;
grant execute on function public.add_brokerage_dividend_reinvestment_v2(uuid,uuid,numeric,numeric,uuid,numeric,numeric,timestamptz,text) to authenticated,service_role;
grant execute on function public.add_brokerage_partial_dividend_reinvestment_v2(uuid,uuid,numeric,numeric,numeric,uuid,numeric,numeric,timestamptz,text) to authenticated,service_role;
