create function public.add_brokerage_dividend_reinvestment(p_account_id uuid,p_asset_id uuid,p_gross_dividend numeric,p_withholding_tax numeric default 0,p_fees numeric default 0,p_unit_price numeric default null,p_occurred_at timestamptz default null,p_notes text default null) returns jsonb language plpgsql security definer set search_path='' as $$
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
 (t.id,u,a.id,s.id,'credit',g,g,0,0,null,'brokerage_dividend_gross'),(t.id,u,a.id,s.id,'debit',x,x,0,0,null,'brokerage_dividend_tax'),(t.id,u,a.id,s.id,'debit',f,f,0,0,null,'brokerage_dividend_fee'),(t.id,u,a.id,s.id,'debit',n,n,q,n,p_unit_price,'brokerage_dividend_reinvestment');
 select * into t from public.post_transaction(t.id); return jsonb_build_object('transaction',to_jsonb(t),'net_dividend',n::text,'quantity_added',q::text);
end $$;
revoke all on function public.add_brokerage_dividend_reinvestment(uuid,uuid,numeric,numeric,numeric,numeric,timestamptz,text) from public,anon;
grant execute on function public.add_brokerage_dividend_reinvestment(uuid,uuid,numeric,numeric,numeric,numeric,timestamptz,text) to authenticated;
