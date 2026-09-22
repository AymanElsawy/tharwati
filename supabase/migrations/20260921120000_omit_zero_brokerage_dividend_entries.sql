-- Omit optional dividend tax/fee legs when their ledger-rounded amount is zero.
-- Positive-amount ledger constraints remain unchanged.

create or replace function public.add_brokerage_cash_dividend(
  p_account_id uuid, p_asset_id uuid, p_gross_dividend numeric,
  p_withholding_tax numeric default 0, p_fees numeric default 0,
  p_occurred_at timestamptz default null, p_notes text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid(); v_account public.financial_accounts%rowtype;
  v_asset public.assets%rowtype; v_transaction public.financial_transactions%rowtype;
  v_gross numeric; v_tax numeric; v_fees numeric; v_net numeric;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_account_id is null or p_asset_id is null or p_gross_dividend is null or p_gross_dividend <= 0 then
    raise exception 'Brokerage account, asset, and positive gross dividend are required' using errcode = '22023'; end if;
  if coalesce(p_withholding_tax, 0) < 0 or coalesce(p_fees, 0) < 0 then
    raise exception 'Dividend tax and fees cannot be negative' using errcode = '22023'; end if;
  select * into v_account from public.financial_accounts a where a.id=p_account_id and a.user_id=v_user_id and a.is_active and a.account_type_code='brokerage' for update;
  if not found then raise exception 'selected active Brokerage account is not available' using errcode = 'P0002'; end if;
  select * into v_asset from public.assets a where a.id=p_asset_id and a.is_active and (a.user_id is null or a.user_id=v_user_id) for share;
  if not found then raise exception 'selected visible asset is not available' using errcode = 'P0002'; end if;
  if v_asset.currency_code <> v_account.currency_code then raise exception 'cross-currency dividends are not supported yet' using errcode = '22023'; end if;
  perform 1 from public.holdings h where h.user_id=v_user_id and h.account_id=v_account.id and h.asset_id=v_asset.id and h.quantity > 0 for share;
  if not found then raise exception 'selected asset is not a positive holding in this Brokerage account' using errcode = '23514'; end if;
  v_gross := pg_catalog.round(p_gross_dividend, 10); v_tax := pg_catalog.round(coalesce(p_withholding_tax,0),10); v_fees := pg_catalog.round(coalesce(p_fees,0),10); v_net := v_gross-v_tax-v_fees;
  if v_net <= 0 then raise exception 'Net dividend must be positive' using errcode = '22023'; end if;
  insert into public.financial_transactions(user_id,transaction_type_code,transaction_currency_code,status,occurred_at,description,notes)
  values(v_user_id,'dividend',v_account.currency_code,'draft',coalesce(p_occurred_at,now()),'Dividend: '||v_asset.name,nullif(pg_catalog.btrim(p_notes),'')) returning * into v_transaction;
  insert into public.transaction_entries(transaction_id,user_id,account_id,asset_id,entry_side,transaction_amount,account_amount,quantity_delta,cost_basis_delta,memo) values
    (v_transaction.id,v_user_id,v_account.id,v_asset.id,'credit',v_gross,v_gross,0,0,'brokerage_dividend_gross');
  if v_tax > 0 then
    insert into public.transaction_entries(transaction_id,user_id,account_id,asset_id,entry_side,transaction_amount,account_amount,quantity_delta,cost_basis_delta,memo) values
      (v_transaction.id,v_user_id,v_account.id,v_asset.id,'debit',v_tax,v_tax,0,0,'brokerage_dividend_tax');
  end if;
  if v_fees > 0 then
    insert into public.transaction_entries(transaction_id,user_id,account_id,asset_id,entry_side,transaction_amount,account_amount,quantity_delta,cost_basis_delta,memo) values
      (v_transaction.id,v_user_id,v_account.id,v_asset.id,'debit',v_fees,v_fees,0,0,'brokerage_dividend_fee');
  end if;
  insert into public.transaction_entries(transaction_id,user_id,account_id,asset_id,entry_side,transaction_amount,account_amount,quantity_delta,cost_basis_delta,memo) values
    (v_transaction.id,v_user_id,v_account.id,null,'debit',v_net,v_net,null,null,'brokerage_dividend_cash');
  select * into v_transaction from public.post_transaction(v_transaction.id);
  return jsonb_build_object('transaction',to_jsonb(v_transaction),'gross_dividend',v_gross::text,'withholding_tax',v_tax::text,'fees',v_fees::text,'net_dividend',v_net::text);
end; $$;

create or replace function public.add_brokerage_dividend_reinvestment(p_account_id uuid,p_asset_id uuid,p_gross_dividend numeric,p_withholding_tax numeric default 0,p_fees numeric default 0,p_unit_price numeric default null,p_occurred_at timestamptz default null,p_notes text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); a public.financial_accounts%rowtype; s public.assets%rowtype; t public.financial_transactions%rowtype; g numeric; x numeric; f numeric; n numeric; q numeric;
begin
 if u is null then raise exception 'authentication required' using errcode='42501'; end if;
 if p_account_id is null or p_asset_id is null or p_gross_dividend is null or p_gross_dividend<=0 or p_unit_price is null or p_unit_price<=0 then raise exception 'Brokerage account, asset, positive gross dividend, and positive reinvestment unit price are required' using errcode='22023'; end if;
 if coalesce(p_withholding_tax,0)<0 or coalesce(p_fees,0)<0 then raise exception 'Dividend tax and fees cannot be negative' using errcode='22023'; end if;
 select * into a from public.financial_accounts where id=p_account_id and user_id=u and is_active and account_type_code='brokerage' for update; if not found then raise exception 'selected active Brokerage account is not available' using errcode='P0002'; end if;
 select * into s from public.assets where id=p_asset_id and is_active and (user_id is null or user_id=u) for share; if not found then raise exception 'selected visible asset is not available' using errcode='P0002'; end if;
 if s.currency_code<>a.currency_code then raise exception 'cross-currency dividends are not supported yet' using errcode='22023'; end if;
 perform 1 from public.holdings where user_id=u and account_id=a.id and asset_id=s.id and quantity>0 for share; if not found then raise exception 'selected asset is not a positive holding in this Brokerage account' using errcode='23514'; end if;
 g:=round(p_gross_dividend,10); x:=round(coalesce(p_withholding_tax,0),10); f:=round(coalesce(p_fees,0),10); n:=g-x-f; if n<=0 then raise exception 'Net dividend must be positive' using errcode='22023'; end if; q:=round(n/p_unit_price,10); if q<=0 then raise exception 'Dividend reinvestment quantity must be positive' using errcode='22023'; end if;
 insert into public.financial_transactions(user_id,transaction_type_code,transaction_currency_code,status,occurred_at,description,notes) values(u,'dividend',a.currency_code,'draft',coalesce(p_occurred_at,now()),'Dividend reinvested: '||s.name,nullif(btrim(p_notes),'')) returning * into t;
 insert into public.transaction_entries(transaction_id,user_id,account_id,asset_id,entry_side,transaction_amount,account_amount,quantity_delta,cost_basis_delta,unit_price,memo) values
   (t.id,u,a.id,s.id,'credit',g,g,0,0,null,'brokerage_dividend_gross');
 if x > 0 then
   insert into public.transaction_entries(transaction_id,user_id,account_id,asset_id,entry_side,transaction_amount,account_amount,quantity_delta,cost_basis_delta,unit_price,memo) values
     (t.id,u,a.id,s.id,'debit',x,x,0,0,null,'brokerage_dividend_tax');
 end if;
 if f > 0 then
   insert into public.transaction_entries(transaction_id,user_id,account_id,asset_id,entry_side,transaction_amount,account_amount,quantity_delta,cost_basis_delta,unit_price,memo) values
     (t.id,u,a.id,s.id,'debit',f,f,0,0,null,'brokerage_dividend_fee');
 end if;
 insert into public.transaction_entries(transaction_id,user_id,account_id,asset_id,entry_side,transaction_amount,account_amount,quantity_delta,cost_basis_delta,unit_price,memo) values
   (t.id,u,a.id,s.id,'debit',n,n,q,n,p_unit_price,'brokerage_dividend_reinvestment');
 select * into t from public.post_transaction(t.id); return jsonb_build_object('transaction',to_jsonb(t),'net_dividend',n::text,'quantity_added',q::text);
end $$;

create or replace function public.add_brokerage_partial_dividend_reinvestment(
  p_account_id uuid, p_asset_id uuid, p_gross_dividend numeric,
  p_withholding_tax numeric default 0, p_fees numeric default 0,
  p_reinvested_amount numeric default null, p_unit_price numeric default null,
  p_occurred_at timestamptz default null, p_notes text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_user_id uuid := auth.uid(); v_account public.financial_accounts%rowtype;
  v_asset public.assets%rowtype; v_transaction public.financial_transactions%rowtype;
  v_gross numeric; v_tax numeric; v_fees numeric; v_net numeric;
  v_reinvested numeric; v_cash_remainder numeric; v_quantity numeric;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_account_id is null or p_asset_id is null or p_gross_dividend is null or p_gross_dividend <= 0 or p_reinvested_amount is null or p_reinvested_amount <= 0 or p_unit_price is null or p_unit_price <= 0 then
    raise exception 'Brokerage account, asset, positive gross dividend, positive reinvested amount, and positive reinvestment unit price are required' using errcode='22023';
  end if;
  if coalesce(p_withholding_tax, 0) < 0 or coalesce(p_fees, 0) < 0 then raise exception 'Dividend tax and fees cannot be negative' using errcode='22023'; end if;
  select * into v_account from public.financial_accounts a where a.id=p_account_id and a.user_id=v_user_id and a.is_active and a.account_type_code='brokerage' for update;
  if not found then raise exception 'selected active Brokerage account is not available' using errcode='P0002'; end if;
  select * into v_asset from public.assets a where a.id=p_asset_id and a.is_active and (a.user_id is null or a.user_id=v_user_id) for share;
  if not found then raise exception 'selected visible asset is not available' using errcode='P0002'; end if;
  if v_asset.currency_code <> v_account.currency_code then raise exception 'cross-currency dividends are not supported yet' using errcode='22023'; end if;
  perform 1 from public.holdings h where h.user_id=v_user_id and h.account_id=v_account.id and h.asset_id=v_asset.id and h.quantity > 0 for share;
  if not found then raise exception 'selected asset is not a positive holding in this Brokerage account' using errcode='23514'; end if;
  v_gross := pg_catalog.round(p_gross_dividend, 10); v_tax := pg_catalog.round(coalesce(p_withholding_tax, 0), 10); v_fees := pg_catalog.round(coalesce(p_fees, 0), 10);
  v_net := v_gross - v_tax - v_fees; v_reinvested := pg_catalog.round(p_reinvested_amount, 10);
  if v_net <= 0 then raise exception 'Net dividend must be positive' using errcode='22023'; end if;
  if v_reinvested >= v_net then raise exception 'Partial reinvested amount must be less than net dividend; use full reinvestment for the full amount' using errcode='22023'; end if;
  v_cash_remainder := v_net - v_reinvested; v_quantity := pg_catalog.round(v_reinvested / p_unit_price, 10);
  if v_quantity <= 0 then raise exception 'Dividend reinvestment quantity must be positive' using errcode='22023'; end if;
  insert into public.financial_transactions(user_id,transaction_type_code,transaction_currency_code,status,occurred_at,description,notes)
  values(v_user_id,'dividend',v_account.currency_code,'draft',coalesce(p_occurred_at,now()),'Dividend partially reinvested: '||v_asset.name,nullif(pg_catalog.btrim(p_notes),'')) returning * into v_transaction;
  insert into public.transaction_entries(transaction_id,user_id,account_id,asset_id,entry_side,transaction_amount,account_amount,quantity_delta,cost_basis_delta,unit_price,memo) values
    (v_transaction.id,v_user_id,v_account.id,v_asset.id,'credit',v_gross,v_gross,0,0,null,'brokerage_dividend_gross');
  if v_tax > 0 then
    insert into public.transaction_entries(transaction_id,user_id,account_id,asset_id,entry_side,transaction_amount,account_amount,quantity_delta,cost_basis_delta,unit_price,memo) values
      (v_transaction.id,v_user_id,v_account.id,v_asset.id,'debit',v_tax,v_tax,0,0,null,'brokerage_dividend_tax');
  end if;
  if v_fees > 0 then
    insert into public.transaction_entries(transaction_id,user_id,account_id,asset_id,entry_side,transaction_amount,account_amount,quantity_delta,cost_basis_delta,unit_price,memo) values
      (v_transaction.id,v_user_id,v_account.id,v_asset.id,'debit',v_fees,v_fees,0,0,null,'brokerage_dividend_fee');
  end if;
  insert into public.transaction_entries(transaction_id,user_id,account_id,asset_id,entry_side,transaction_amount,account_amount,quantity_delta,cost_basis_delta,unit_price,memo) values
    (v_transaction.id,v_user_id,v_account.id,v_asset.id,'debit',v_reinvested,v_reinvested,v_quantity,v_reinvested,p_unit_price,'brokerage_dividend_partial_reinvestment'),
    (v_transaction.id,v_user_id,v_account.id,null,'debit',v_cash_remainder,v_cash_remainder,null,null,null,'brokerage_dividend_partial_cash');
  select * into v_transaction from public.post_transaction(v_transaction.id);
  return jsonb_build_object('transaction',to_jsonb(v_transaction),'net_dividend',v_net::text,'reinvested_amount',v_reinvested::text,'cash_remainder',v_cash_remainder::text,'quantity_added',v_quantity::text);
end; $$;

revoke all on function public.add_brokerage_cash_dividend(uuid,uuid,numeric,numeric,numeric,timestamptz,text) from public, anon;
grant execute on function public.add_brokerage_cash_dividend(uuid,uuid,numeric,numeric,numeric,timestamptz,text) to authenticated;
revoke all on function public.add_brokerage_dividend_reinvestment(uuid,uuid,numeric,numeric,numeric,numeric,timestamptz,text) from public,anon;
grant execute on function public.add_brokerage_dividend_reinvestment(uuid,uuid,numeric,numeric,numeric,numeric,timestamptz,text) to authenticated;
revoke all on function public.add_brokerage_partial_dividend_reinvestment(uuid,uuid,numeric,numeric,numeric,numeric,numeric,timestamptz,text) from public,anon;
grant execute on function public.add_brokerage_partial_dividend_reinvestment(uuid,uuid,numeric,numeric,numeric,numeric,numeric,timestamptz,text) to authenticated;
