


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."account_disposals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "disposed_on" "date" NOT NULL,
    "sale_amount" numeric(20,2) NOT NULL,
    "sale_currency_code" "text" NOT NULL,
    "ownership_percentage_sold" numeric(5,2) NOT NULL,
    "notes" "text",
    "corrects_disposal_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "idempotency_key" "uuid",
    "proceeds_account_id" "uuid",
    "proceeds_transaction_id" "uuid",
    CONSTRAINT "account_disposals_not_self_correcting" CHECK (("id" IS DISTINCT FROM "corrects_disposal_id")),
    CONSTRAINT "account_disposals_ownership_percentage_sold_check" CHECK ((("ownership_percentage_sold" > (0)::numeric) AND ("ownership_percentage_sold" <= (100)::numeric))),
    CONSTRAINT "account_disposals_proceeds_link_pair_check" CHECK ((("proceeds_account_id" IS NULL) = ("proceeds_transaction_id" IS NULL))),
    CONSTRAINT "account_disposals_sale_amount_check" CHECK (("sale_amount" >= (0)::numeric)),
    CONSTRAINT "account_disposals_sale_currency_code_check" CHECK (("sale_currency_code" = ANY (ARRAY['USD'::"text", 'SAR'::"text", 'EGP'::"text", 'EUR'::"text", 'GBP'::"text", 'AED'::"text"])))
);


ALTER TABLE "public"."account_disposals" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_account_disposal"("p_account_id" "uuid", "p_disposed_on" "date", "p_sale_amount" numeric, "p_sale_currency_code" "text", "p_ownership_percentage_sold" numeric, "p_idempotency_key" "uuid", "p_notes" "text" DEFAULT NULL::"text", "p_destination_account_id" "uuid" DEFAULT NULL::"uuid") RETURNS "public"."account_disposals"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_account public.financial_accounts%rowtype;
  v_existing public.account_disposals%rowtype;
  v_row public.account_disposals;
  v_disposal_id uuid := gen_random_uuid();
  v_proceeds_transaction_id uuid;
  v_sale_amount numeric(20, 2);
  v_ownership_percentage_sold numeric(5, 2);
  v_notes text;
  v_expected_destination_account_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  if p_idempotency_key is null then
    raise exception 'An idempotency key is required' using errcode = '23514';
  end if;
  if p_sale_amount is null
    or lower(p_sale_amount::text) in ('nan', 'infinity', '-infinity')
    or p_sale_amount < 0
    or p_sale_amount >= 1000000000000000000::numeric
    or p_sale_amount <> trunc(p_sale_amount, 2) then
    raise exception 'Sale amount must be finite, non-negative, and have at most 2 decimal places'
      using errcode = '23514';
  end if;
  v_sale_amount := p_sale_amount;
  if p_disposed_on is null or p_disposed_on > current_date
    or p_sale_currency_code not in ('USD', 'SAR', 'EGP', 'EUR', 'GBP', 'AED')
    or p_ownership_percentage_sold is null
    or p_ownership_percentage_sold <= 0 or p_ownership_percentage_sold > 100 then
    raise exception 'Valid non-future disposal fields are required'
      using errcode = '23514';
  end if;
  v_ownership_percentage_sold := p_ownership_percentage_sold;
  v_notes := nullif(btrim(p_notes), '');
  v_expected_destination_account_id := case
    when v_sale_amount > 0 then p_destination_account_id
    else null
  end;
  if v_sale_amount > 0 and p_destination_account_id is null then
    raise exception 'A destination account is required for positive sale proceeds'
      using errcode = '23514';
  end if;
  if v_sale_amount = 0 and p_destination_account_id is not null then
    raise exception 'A zero-proceeds disposal cannot have a destination account'
      using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    v_user_id::text || ':' || p_idempotency_key::text,
    0
  ));

  select * into v_existing
  from public.account_disposals
  where user_id = v_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.account_id = p_account_id
      and v_existing.disposed_on = p_disposed_on
      and v_existing.sale_amount = v_sale_amount
      and v_existing.sale_currency_code = p_sale_currency_code
      and v_existing.ownership_percentage_sold = v_ownership_percentage_sold
      and v_existing.notes is not distinct from v_notes
      and v_existing.proceeds_account_id is not distinct from v_expected_destination_account_id then
      return v_existing;
    end if;
    raise exception 'Idempotency key was already used with different disposal data'
      using errcode = '23514';
  end if;

  select * into v_account
  from public.financial_accounts
  where id = p_account_id and user_id = v_user_id and is_active
  for update;
  if not found or v_account.account_type_code not in ('real_estate', 'business') then
    raise exception 'An active owned Real Estate or Business account is required'
      using errcode = '23514';
  end if;
  if v_sale_amount > 0 then
    v_proceeds_transaction_id := public.post_account_disposal_proceeds_internal(
      v_disposal_id, v_account.account_type_code, p_destination_account_id,
      v_sale_amount, p_sale_currency_code, p_disposed_on, v_notes
    );
  end if;

  insert into public.account_disposals (
    id, user_id, account_id, disposed_on, sale_amount, sale_currency_code,
    ownership_percentage_sold, notes, idempotency_key,
    proceeds_account_id, proceeds_transaction_id
  ) values (
    v_disposal_id, v_user_id, p_account_id, p_disposed_on, v_sale_amount,
    p_sale_currency_code, v_ownership_percentage_sold, v_notes,
    p_idempotency_key, v_expected_destination_account_id,
    v_proceeds_transaction_id
  ) returning * into v_row;

  perform public.recalculate_account_disposal_projection(p_account_id);
  return v_row;
end;
$$;


ALTER FUNCTION "public"."add_account_disposal"("p_account_id" "uuid", "p_disposed_on" "date", "p_sale_amount" numeric, "p_sale_currency_code" "text", "p_ownership_percentage_sold" numeric, "p_idempotency_key" "uuid", "p_notes" "text", "p_destination_account_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."add_account_disposal"("p_account_id" "uuid", "p_disposed_on" "date", "p_sale_amount" numeric, "p_sale_currency_code" "text", "p_ownership_percentage_sold" numeric, "p_idempotency_key" "uuid", "p_notes" "text", "p_destination_account_id" "uuid") IS 'Idempotently adds an owned Real Estate or Business disposal and atomically posts canonical positive proceeds to an active owned same-currency Cash or Bank account. Zero proceeds require no destination.';



CREATE OR REPLACE FUNCTION "public"."add_account_record"("p_record_type" "text", "p_account_id" "uuid", "p_counterparty_account_id" "uuid", "p_amount" numeric, "p_received_amount" numeric, "p_occurred_at" timestamp with time zone, "p_category" "text", "p_notes" "text", "p_main_category_id" "uuid" DEFAULT NULL::"uuid", "p_subcategory_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."add_account_record"("p_record_type" "text", "p_account_id" "uuid", "p_counterparty_account_id" "uuid", "p_amount" numeric, "p_received_amount" numeric, "p_occurred_at" timestamp with time zone, "p_category" "text", "p_notes" "text", "p_main_category_id" "uuid", "p_subcategory_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_account_record_linked"("p_record_type" "text", "p_account_id" "uuid", "p_counterparty_account_id" "uuid", "p_amount" numeric, "p_received_amount" numeric, "p_occurred_at" timestamp with time zone, "p_category" "text", "p_notes" "text", "p_main_category_id" "uuid", "p_subcategory_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."add_account_record_linked"("p_record_type" "text", "p_account_id" "uuid", "p_counterparty_account_id" "uuid", "p_amount" numeric, "p_received_amount" numeric, "p_occurred_at" timestamp with time zone, "p_category" "text", "p_notes" "text", "p_main_category_id" "uuid", "p_subcategory_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."account_valuations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "valuation_amount" numeric(20,2) NOT NULL,
    "valued_on" "date" NOT NULL,
    "valuation_method" "text",
    "notes" "text",
    "corrects_valuation_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "account_valuations_not_self_correcting" CHECK (("id" IS DISTINCT FROM "corrects_valuation_id")),
    CONSTRAINT "account_valuations_valuation_amount_check" CHECK (("valuation_amount" >= (0)::numeric))
);


ALTER TABLE "public"."account_valuations" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_account_valuation"("p_account_id" "uuid", "p_valuation_amount" numeric, "p_valued_on" "date", "p_valuation_method" "text" DEFAULT NULL::"text", "p_notes" "text" DEFAULT NULL::"text") RETURNS "public"."account_valuations"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_account public.financial_accounts;
  v_row public.account_valuations;
  v_whitespace constant text := E' \t\n\r\f' || chr(11) || U&'\0085\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000';
  v_method text := nullif(btrim(coalesce(p_valuation_method, ''), v_whitespace), '');
  v_custom_method text;
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
  if v_method like 'other:%' then
    v_custom_method := btrim(substring(v_method from 7), v_whitespace);
    if nullif(v_custom_method, '') is null then
      raise exception using errcode = '23514', message = case
        when v_account.account_type_code = 'business' then 'A supported Business valuation method is required'
        else 'A supported Real Estate valuation method is required'
      end;
    end if;
    v_method := 'other:' || v_custom_method;
  elsif v_account.account_type_code = 'business' and v_method is not null
    and v_method not in (
      'owner_estimate', 'professional_appraisal', 'market_comparison',
      'revenue_multiple', 'ebitda_multiple', 'discounted_cash_flow',
      'asset_based', 'recent_transaction'
    ) then
    raise exception using errcode = '23514', message = 'A supported Business valuation method is required';
  elsif v_account.account_type_code = 'real_estate' and v_method is not null
    and v_method not in (
      'owner_estimate', 'professional_appraisal', 'market_comparison',
      'income_approach', 'cost_approach', 'recent_transaction'
    ) then
    raise exception using errcode = '23514', message = 'A supported Real Estate valuation method is required';
  end if;
  insert into public.account_valuations (user_id, account_id, valuation_amount, valued_on, valuation_method, notes)
  values (auth.uid(), p_account_id, p_valuation_amount, p_valued_on,
    v_method, nullif(btrim(p_notes), '')) returning * into v_row;
  return v_row;
end;
$$;


ALTER FUNCTION "public"."add_account_valuation"("p_account_id" "uuid", "p_valuation_amount" numeric, "p_valued_on" "date", "p_valuation_method" "text", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_brokerage_buy"("p_account_id" "uuid", "p_asset_id" "uuid", "p_quantity" numeric, "p_unit_price" numeric, "p_occurred_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_notes" "text" DEFAULT NULL::"text", "p_fees" numeric DEFAULT 0, "p_account_fx_rate" numeric DEFAULT NULL::numeric) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  return public.post_brokerage_buy_internal(
    p_account_id, p_asset_id, p_quantity, p_unit_price, p_occurred_at,
    p_notes, p_fees, p_account_fx_rate
  );
end;
$$;


ALTER FUNCTION "public"."add_brokerage_buy"("p_account_id" "uuid", "p_asset_id" "uuid", "p_quantity" numeric, "p_unit_price" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_fees" numeric, "p_account_fx_rate" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."add_brokerage_buy"("p_account_id" "uuid", "p_asset_id" "uuid", "p_quantity" numeric, "p_unit_price" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_fees" numeric, "p_account_fx_rate" numeric) IS 'Posts an owned active Brokerage Buy using Brokerage Available Cash only. Quantity and unit price are in the asset canonical unit and asset currency; fees are asset-currency acquisition cost and cash outflow. Cross-currency buys require immutable historical account FX. No Cash/Bank or external funding entry is created.';



CREATE OR REPLACE FUNCTION "public"."add_brokerage_cash_dividend"("p_account_id" "uuid", "p_asset_id" "uuid", "p_gross_dividend" numeric, "p_withholding_tax" numeric DEFAULT 0, "p_fees" numeric DEFAULT 0, "p_occurred_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_notes" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."add_brokerage_cash_dividend"("p_account_id" "uuid", "p_asset_id" "uuid", "p_gross_dividend" numeric, "p_withholding_tax" numeric, "p_fees" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_brokerage_cash_transfer"("p_source_account_id" "uuid", "p_destination_account_id" "uuid", "p_amount" numeric, "p_received_amount" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  return public.post_brokerage_cash_transfer_internal(
    p_source_account_id, p_destination_account_id, p_amount, p_received_amount,
    p_occurred_at, p_notes, null
  );
end;
$$;


ALTER FUNCTION "public"."add_brokerage_cash_transfer"("p_source_account_id" "uuid", "p_destination_account_id" "uuid", "p_amount" numeric, "p_received_amount" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_brokerage_dividend_reinvestment"("p_account_id" "uuid", "p_asset_id" "uuid", "p_gross_dividend" numeric, "p_withholding_tax" numeric DEFAULT 0, "p_fees" numeric DEFAULT 0, "p_unit_price" numeric DEFAULT NULL::numeric, "p_occurred_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_notes" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."add_brokerage_dividend_reinvestment"("p_account_id" "uuid", "p_asset_id" "uuid", "p_gross_dividend" numeric, "p_withholding_tax" numeric, "p_fees" numeric, "p_unit_price" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_brokerage_partial_dividend_reinvestment"("p_account_id" "uuid", "p_asset_id" "uuid", "p_gross_dividend" numeric, "p_withholding_tax" numeric DEFAULT 0, "p_fees" numeric DEFAULT 0, "p_reinvested_amount" numeric DEFAULT NULL::numeric, "p_unit_price" numeric DEFAULT NULL::numeric, "p_occurred_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_notes" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."add_brokerage_partial_dividend_reinvestment"("p_account_id" "uuid", "p_asset_id" "uuid", "p_gross_dividend" numeric, "p_withholding_tax" numeric, "p_fees" numeric, "p_reinvested_amount" numeric, "p_unit_price" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_brokerage_sell"("p_account_id" "uuid", "p_asset_id" "uuid", "p_quantity" numeric, "p_unit_sale_price" numeric, "p_occurred_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_notes" "text" DEFAULT NULL::"text", "p_fees" numeric DEFAULT 0, "p_account_fx_rate" numeric DEFAULT NULL::numeric) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  return public.post_brokerage_sell_internal(
    p_account_id, p_asset_id, p_quantity, p_unit_sale_price, p_occurred_at,
    p_notes, p_fees, p_account_fx_rate
  );
end;
$$;


ALTER FUNCTION "public"."add_brokerage_sell"("p_account_id" "uuid", "p_asset_id" "uuid", "p_quantity" numeric, "p_unit_sale_price" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_fees" numeric, "p_account_fx_rate" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."add_brokerage_sell"("p_account_id" "uuid", "p_asset_id" "uuid", "p_quantity" numeric, "p_unit_sale_price" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_fees" numeric, "p_account_fx_rate" numeric) IS 'Posts an owned active Brokerage Sell. Quantity is reduced by a proportional moving-average cost basis reduction; net proceeds after asset-currency fees credit only Brokerage Available Cash. Cross-currency sales require immutable sale FX; cost basis retains its own historical derived FX. No realized P/L, Cash/Bank, or external funding entry is created.';



CREATE OR REPLACE FUNCTION "public"."add_existing_holding"("p_account_id" "uuid", "p_asset_id" "uuid", "p_quantity" numeric, "p_average_cost" numeric, "p_occurred_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_notes" "text" DEFAULT NULL::"text", "p_account_fx_rate" numeric DEFAULT NULL::numeric) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  return public.post_existing_holding_internal(
    p_account_id,
    p_asset_id,
    p_quantity,
    p_average_cost,
    p_occurred_at,
    p_notes,
    p_account_fx_rate
  );
end;
$$;


ALTER FUNCTION "public"."add_existing_holding"("p_account_id" "uuid", "p_asset_id" "uuid", "p_quantity" numeric, "p_average_cost" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_account_fx_rate" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."add_existing_holding"("p_account_id" "uuid", "p_asset_id" "uuid", "p_quantity" numeric, "p_average_cost" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_account_fx_rate" numeric) IS 'Posts an owned active Brokerage existing holding as an opening position. average_cost is per canonical quantity unit in the asset currency. A positive account FX rate is required only when that currency differs from the Brokerage account; it produces immutable account-currency historical cost basis without a non-asset Brokerage entry, so Available Cash and opening_balance remain unchanged.';



CREATE OR REPLACE FUNCTION "public"."add_expense_refund"("p_expense_transaction_id" "uuid", "p_amount" numeric, "p_occurred_at" timestamp with time zone, "p_idempotency_key" "uuid", "p_destination_account_id" "uuid" DEFAULT NULL::"uuid", "p_notes" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_expense public.financial_transactions%rowtype;
  v_existing public.financial_transactions%rowtype;
  v_original_account public.financial_accounts%rowtype;
  v_destination public.financial_accounts%rowtype;
  v_transaction public.financial_transactions%rowtype;
  v_original_amount numeric;
  v_effective_refunded numeric;
  v_destination_balance numeric;
  v_destination_account_id uuid;
  v_notes text := nullif(btrim(p_notes), '');
  v_existing_amount numeric;
  v_existing_destination_id uuid;
  v_entry_count integer;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_idempotency_key is null then
    raise exception 'refund idempotency key is required' using errcode = '23514';
  end if;
  if p_amount is null
    or lower(p_amount::text) in ('nan', 'infinity', '-infinity')
    or p_amount <= 0
    or p_amount >= 100000000000000000000::numeric
    or p_amount <> trunc(p_amount, 10) then
    raise exception 'refund amount must be finite, positive, and have at most 10 decimal places'
      using errcode = '23514';
  end if;
  if p_occurred_at is null then
    raise exception 'refund date and time are required' using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    v_user_id::text || ':' || p_idempotency_key::text,
    0
  ));

  select entry.account_id into v_destination_account_id
  from public.financial_transactions expense
  join public.transaction_entries entry
    on entry.transaction_id = expense.id
   and entry.account_id is not null
   and entry.entry_side = 'credit'
  where expense.id = p_expense_transaction_id
    and expense.user_id = v_user_id
    and expense.transaction_type_code = 'expense';
  v_destination_account_id := coalesce(p_destination_account_id, v_destination_account_id);

  select * into v_existing
  from public.financial_transactions
  where user_id = v_user_id
    and refund_idempotency_key = p_idempotency_key;

  if found then
    if v_existing.transaction_type_code <> 'refund' then
      raise exception 'refund idempotency key was already used by another operation'
        using errcode = '23505';
    end if;

    select e.account_id, e.account_amount
    into v_existing_destination_id, v_existing_amount
    from public.transaction_entries e
    where e.transaction_id = v_existing.id
      and e.account_id is not null
      and e.entry_side = 'debit'
      and e.memo = 'expense_refund_received';

    if v_existing.refunds_transaction_id = p_expense_transaction_id
      and v_existing.occurred_at = p_occurred_at
      and v_existing.notes is not distinct from v_notes
      and v_existing_amount = p_amount
      and v_existing_destination_id = v_destination_account_id then
      return jsonb_build_object('transaction', to_jsonb(v_existing), 'idempotent', true);
    end if;
    raise exception 'refund idempotency key was already used with different refund data'
      using errcode = '23505';
  end if;

  select * into v_expense
  from public.financial_transactions
  where id = p_expense_transaction_id
    and user_id = v_user_id
    and transaction_type_code = 'expense'
    and status = 'posted'
    and reverses_transaction_id is null
  for update;

  if not found
    or exists (
      select 1 from public.financial_transactions reversal
      where reversal.reverses_transaction_id = p_expense_transaction_id
        and reversal.status = 'posted'
    )
    or exists (
      select 1 from public.financial_transactions replacement
      where replacement.corrects_transaction_id = p_expense_transaction_id
        and replacement.status = 'posted'
    ) then
    raise exception 'effective posted expense is not available for refund'
      using errcode = 'P0002';
  end if;

  select count(*)
  into v_entry_count
  from public.transaction_entries e
  where e.transaction_id = v_expense.id;

  select account.* into v_original_account
  from public.financial_accounts account
  join public.transaction_entries entry on entry.account_id = account.id
  where entry.transaction_id = v_expense.id
    and entry.entry_side = 'credit'
    and entry.memo <> 'owner_draw'
    and account.user_id = v_user_id
    and account.account_type_code in ('cash', 'bank');

  select entry.account_amount into v_original_amount
  from public.transaction_entries entry
  where entry.transaction_id = v_expense.id
    and entry.account_id = v_original_account.id
    and entry.entry_side = 'credit';

  if v_entry_count <> 2 or not found or not exists (
    select 1
    from public.transaction_entries entry
    where entry.transaction_id = v_expense.id
      and entry.account_id is null
      and entry.entry_side = 'debit'
      and entry.memo = 'owner_draw'
      and entry.transaction_amount = v_original_amount
      and entry.account_amount = v_original_amount
  ) then
    raise exception 'transaction is not a supported expense record' using errcode = '22023';
  end if;

  v_destination_account_id := coalesce(p_destination_account_id, v_original_account.id);

  select * into v_destination
  from public.financial_accounts
  where id = v_destination_account_id
    and user_id = v_user_id
    and is_active
    and account_type_code in ('cash', 'bank')
  for update;
  if not found then
    raise exception 'refund destination account is not available' using errcode = '42501';
  end if;
  if v_destination.currency_code <> v_expense.transaction_currency_code
    or v_destination.currency_code <> v_original_account.currency_code then
    raise exception 'refund destination must use the expense currency'
      using errcode = '23514';
  end if;

  select coalesce(sum(refund_entry.account_amount), 0)
  into v_effective_refunded
  from public.financial_transactions refund
  join public.transaction_entries refund_entry
    on refund_entry.transaction_id = refund.id
   and refund_entry.account_id is not null
   and refund_entry.entry_side = 'debit'
   and refund_entry.memo = 'expense_refund_received'
  where refund.refunds_transaction_id = v_expense.id
    and refund.user_id = v_user_id
    and refund.transaction_type_code = 'refund'
    and refund.status = 'posted'
    and not exists (
      select 1
      from public.financial_transactions cancellation
      where cancellation.reverses_transaction_id = refund.id
        and cancellation.transaction_type_code = 'refund_cancellation'
        and cancellation.status = 'posted'
    );

  if v_effective_refunded + p_amount > v_original_amount then
    raise exception 'refund total would exceed original expense amount'
      using errcode = '23514';
  end if;

  select v_destination.opening_balance + coalesce(sum(
    case entry.entry_side when 'debit' then entry.account_amount else -entry.account_amount end
  ) filter (where transaction.status = 'posted'), 0)
  into v_destination_balance
  from public.transaction_entries entry
  join public.financial_transactions transaction on transaction.id = entry.transaction_id
  where entry.account_id = v_destination.id and entry.asset_id is null;

  if v_destination.account_type_code = 'bank' and v_destination.bank_subtype = 'credit' then
    if v_destination.credit_card_limit is null then
      raise exception 'credit account requires a credit card limit before available credit can increase'
        using errcode = '23514';
    end if;
    if v_destination_balance + p_amount > v_destination.credit_card_limit then
      raise exception 'available credit would exceed its credit limit' using errcode = '23514';
    end if;
  end if;

  insert into public.financial_transactions (
    user_id, transaction_type_code, transaction_currency_code, status,
    occurred_at, description, notes, main_category_id, subcategory_id,
    refunds_transaction_id, refund_idempotency_key
  ) values (
    v_user_id, 'refund', v_expense.transaction_currency_code, 'draft',
    p_occurred_at, 'Refund: ' || v_expense.description, v_notes,
    v_expense.main_category_id, v_expense.subcategory_id,
    v_expense.id, p_idempotency_key
  ) returning * into v_transaction;

  insert into public.transaction_entries (
    transaction_id, user_id, account_id, entry_side,
    transaction_amount, account_amount, memo
  ) values (
    v_transaction.id, v_user_id, v_destination.id, 'debit',
    p_amount, p_amount, 'expense_refund_received'
  ), (
    v_transaction.id, v_user_id, null, 'credit',
    p_amount, p_amount, 'expense_refund'
  );

  select * into v_transaction from public.post_transaction(v_transaction.id);
  return jsonb_build_object('transaction', to_jsonb(v_transaction), 'idempotent', false);
end;
$$;


ALTER FUNCTION "public"."add_expense_refund"("p_expense_transaction_id" "uuid", "p_amount" numeric, "p_occurred_at" timestamp with time zone, "p_idempotency_key" "uuid", "p_destination_account_id" "uuid", "p_notes" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."add_expense_refund"("p_expense_transaction_id" "uuid", "p_amount" numeric, "p_occurred_at" timestamp with time zone, "p_idempotency_key" "uuid", "p_destination_account_id" "uuid", "p_notes" "text") IS 'Posts an idempotent partial or full same-currency Refund linked to one effective owned Expense.';



CREATE OR REPLACE FUNCTION "public"."add_goal_progress_entry"("p_goal_id" "uuid", "p_entry_type" "text", "p_amount" numeric, "p_effective_on" "date", "p_note" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_user_id uuid := auth.uid(); v_entry_id uuid; v_goal public.goals%rowtype;
begin
  if p_entry_type not in ('progress','withdrawal') then raise exception 'Invalid goal entry type'; end if;
  if p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  if p_effective_on > current_date then raise exception 'Progress date cannot be in the future'; end if;
  select * into v_goal from public.goals where id=p_goal_id and user_id=v_user_id for update;
  if not found then raise exception 'Goal not found'; end if;
  if v_goal.status <> 'active' or v_goal.archived_at is not null then raise exception 'Goal must be active and unarchived'; end if;
  if p_entry_type='withdrawal' and public.goal_funded_amount(p_goal_id) < p_amount then raise exception 'Withdrawal exceeds funded amount'; end if;
  insert into public.goal_progress_entries(goal_id,user_id,entry_type,amount,effective_on,note)
  values(p_goal_id,v_user_id,p_entry_type,p_amount,p_effective_on,nullif(btrim(p_note),'')) returning id into v_entry_id;
  return v_entry_id;
end; $$;


ALTER FUNCTION "public"."add_goal_progress_entry"("p_goal_id" "uuid", "p_entry_type" "text", "p_amount" numeric, "p_effective_on" "date", "p_note" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financial_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "account_type_code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "currency_code" "text" NOT NULL,
    "opening_balance" numeric(20,2) DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "bank_subtype" "text",
    "investment_type" "text",
    "balance_grams" numeric(20,3),
    "property_type" "text",
    "ownership_percentage" numeric(5,2),
    "business_type" "text",
    "industry" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metal_type" "text",
    "purity" "text",
    "purchase_date" "date",
    "cost_per_unit" numeric(20,2),
    "credit_card_limit" numeric(20,2),
    "due_day_of_month" integer,
    "location" "text",
    "initial_ownership_percentage" numeric(5,2),
    "closed_on" "date",
    "closed_reason" "text",
    CONSTRAINT "financial_accounts_balance_grams_check" CHECK ((("balance_grams" IS NULL) OR ("account_type_code" = 'gold'::"text"))),
    CONSTRAINT "financial_accounts_bank_credit_available_balance_check" CHECK ((("credit_card_limit" IS NULL) OR (("opening_balance" >= (0)::numeric) AND ("opening_balance" <= "credit_card_limit")))),
    CONSTRAINT "financial_accounts_bank_credit_fields_check" CHECK (((("credit_card_limit" IS NULL) AND ("due_day_of_month" IS NULL)) OR (("account_type_code" = 'bank'::"text") AND ("bank_subtype" = 'credit'::"text")))),
    CONSTRAINT "financial_accounts_bank_subtype_check" CHECK (((("account_type_code" = 'bank'::"text") AND ("bank_subtype" IS NOT NULL) AND ("bank_subtype" = ANY (ARRAY['debit'::"text", 'credit'::"text"]))) OR (("account_type_code" <> 'bank'::"text") AND ("bank_subtype" IS NULL)))),
    CONSTRAINT "financial_accounts_business_type_check" CHECK ((("business_type" IS NULL) OR ("account_type_code" = 'business'::"text"))),
    CONSTRAINT "financial_accounts_closed_reason_check" CHECK ((("closed_reason" IS NULL) OR ("closed_reason" = 'sold'::"text"))),
    CONSTRAINT "financial_accounts_cost_per_unit_check" CHECK ((("cost_per_unit" IS NULL) OR ("account_type_code" = 'gold'::"text"))),
    CONSTRAINT "financial_accounts_credit_card_limit_positive_check" CHECK ((("credit_card_limit" IS NULL) OR ("credit_card_limit" > (0)::numeric))),
    CONSTRAINT "financial_accounts_currency_code_check" CHECK (("currency_code" = ANY (ARRAY['USD'::"text", 'SAR'::"text", 'EGP'::"text", 'EUR'::"text", 'GBP'::"text", 'AED'::"text"]))),
    CONSTRAINT "financial_accounts_due_day_of_month_range_check" CHECK ((("due_day_of_month" IS NULL) OR (("due_day_of_month" >= 1) AND ("due_day_of_month" <= 31)))),
    CONSTRAINT "financial_accounts_gold_metal_type_required_check" CHECK (((("account_type_code" = 'gold'::"text") AND ("metal_type" = ANY (ARRAY['gold'::"text", 'silver'::"text"]))) OR (("account_type_code" <> 'gold'::"text") AND ("metal_type" IS NULL)))),
    CONSTRAINT "financial_accounts_industry_check" CHECK ((("industry" IS NULL) OR ("account_type_code" = 'business'::"text"))),
    CONSTRAINT "financial_accounts_initial_ownership_percentage_check" CHECK ((("initial_ownership_percentage" IS NULL) OR (("account_type_code" = ANY (ARRAY['real_estate'::"text", 'business'::"text"])) AND (("initial_ownership_percentage" >= (0)::numeric) AND ("initial_ownership_percentage" <= (100)::numeric))))),
    CONSTRAINT "financial_accounts_investment_type_check" CHECK ((("investment_type" IS NULL) OR (("account_type_code" = 'brokerage'::"text") AND ("investment_type" = ANY (ARRAY['stock_etf'::"text", 'crypto'::"text", 'other'::"text"]))))),
    CONSTRAINT "financial_accounts_location_check" CHECK ((("location" IS NULL) OR ("account_type_code" = 'real_estate'::"text"))),
    CONSTRAINT "financial_accounts_metal_type_check" CHECK ((("metal_type" IS NULL) OR (("account_type_code" = 'gold'::"text") AND ("metal_type" = ANY (ARRAY['gold'::"text", 'silver'::"text"]))))),
    CONSTRAINT "financial_accounts_name_not_blank_check" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "financial_accounts_ownership_percentage_check" CHECK ((("ownership_percentage" IS NULL) OR (("account_type_code" = ANY (ARRAY['real_estate'::"text", 'business'::"text"])) AND (("ownership_percentage" >= (0)::numeric) AND ("ownership_percentage" <= (100)::numeric))))),
    CONSTRAINT "financial_accounts_property_type_check" CHECK ((("property_type" IS NULL) OR (("account_type_code" = 'real_estate'::"text") AND ("property_type" = ANY (ARRAY['apartment'::"text", 'villa'::"text", 'land'::"text", 'office'::"text", 'other'::"text"]))))),
    CONSTRAINT "financial_accounts_purchase_date_check" CHECK ((("purchase_date" IS NULL) OR ("account_type_code" = 'gold'::"text"))),
    CONSTRAINT "financial_accounts_purity_check" CHECK ((("purity" IS NULL) OR (("account_type_code" = 'gold'::"text") AND ((("metal_type" = 'gold'::"text") AND ("purity" = ANY (ARRAY['24k'::"text", '22k'::"text", '21k'::"text", '18k'::"text", '14k'::"text", '10k'::"text", '9k'::"text", 'other'::"text"]))) OR (("metal_type" = 'silver'::"text") AND ("purity" = ANY (ARRAY['999'::"text", '958'::"text", '950'::"text", '925'::"text", '900'::"text", '835'::"text", '800'::"text", 'other'::"text"])))))))
);


ALTER TABLE "public"."financial_accounts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."financial_accounts"."credit_card_limit" IS 'Optional credit limit used only by bank credit accounts.';



COMMENT ON COLUMN "public"."financial_accounts"."due_day_of_month" IS 'Optional statement due day from 1 through 31, used only by bank credit accounts.';



CREATE OR REPLACE FUNCTION "public"."add_metal_purchase"("p_account_id" "uuid", "p_purity" "text", "p_occurred_at" timestamp with time zone, "p_quantity_grams" numeric, "p_cost_per_unit" numeric, "p_funding_mode" "text", "p_funding_account_id" "uuid", "p_fees" numeric, "p_notes" "text" DEFAULT NULL::"text") RETURNS "public"."financial_accounts"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_account public.financial_accounts%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;
  perform public.create_metal_purchase_internal(
    v_user_id, p_account_id, p_purity, p_occurred_at, p_quantity_grams,
    p_cost_per_unit, p_funding_mode, p_funding_account_id, p_fees, p_notes
  );
  select * into v_account
  from public.recalculate_metal_purchase_account_internal(v_user_id, p_account_id);
  return v_account;
end;
$$;


ALTER FUNCTION "public"."add_metal_purchase"("p_account_id" "uuid", "p_purity" "text", "p_occurred_at" timestamp with time zone, "p_quantity_grams" numeric, "p_cost_per_unit" numeric, "p_funding_mode" "text", "p_funding_account_id" "uuid", "p_fees" numeric, "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assert_account_record_transaction_balanced"("p_transaction_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_count bigint;
  v_debits numeric;
  v_credits numeric;
begin
  select count(*),
    coalesce(sum(transaction_amount) filter (where entry_side = 'debit'), 0),
    coalesce(sum(transaction_amount) filter (where entry_side = 'credit'), 0)
  into v_count, v_debits, v_credits
  from public.transaction_entries
  where transaction_id = p_transaction_id;
  if v_count < 2 or v_debits <> v_credits then
    raise exception 'transaction is not exactly balanced' using errcode = '23514';
  end if;
end;
$$;


ALTER FUNCTION "public"."assert_account_record_transaction_balanced"("p_transaction_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assert_visible_record_category_selection"("p_user_id" "uuid", "p_main_category_id" "uuid", "p_subcategory_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_main public.record_categories%rowtype;
  v_subcategory public.record_categories%rowtype;
  v_label text;
begin
  select * into v_main from public.record_categories where id = p_main_category_id;
  select * into v_subcategory from public.record_categories where id = p_subcategory_id;
  if v_main.id is null or v_subcategory.id is null
    or v_main.level <> 'main' or v_subcategory.level <> 'subcategory'
    or v_subcategory.parent_id <> v_main.id then
    raise exception 'a valid main category and linked subcategory are required' using errcode = '22023';
  end if;
  if (v_main.user_id is not null and v_main.user_id <> p_user_id)
    or (v_subcategory.user_id is not null and v_subcategory.user_id <> p_user_id)
    or v_main.is_archived or v_subcategory.is_archived then
    raise exception 'selected category is not available' using errcode = '42501';
  end if;
  if exists (select 1 from public.record_category_overrides where user_id = p_user_id and category_id in (v_main.id, v_subcategory.id) and is_hidden) then
    raise exception 'selected category is hidden' using errcode = '22023';
  end if;
  select coalesce(override.name, v_subcategory.name) into v_label
  from (select 1) as ignored
  left join public.record_category_overrides override
    on override.user_id = p_user_id and override.category_id = v_subcategory.id;
  return v_label;
end;
$$;


ALTER FUNCTION "public"."assert_visible_record_category_selection"("p_user_id" "uuid", "p_main_category_id" "uuid", "p_subcategory_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_expense_refund"("p_refund_transaction_id" "uuid", "p_idempotency_key" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_refund public.financial_transactions%rowtype;
  v_existing public.financial_transactions%rowtype;
  v_destination public.financial_accounts%rowtype;
  v_transaction public.financial_transactions%rowtype;
  v_amount numeric;
  v_destination_balance numeric;
  v_entry_count integer;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_idempotency_key is null then
    raise exception 'refund cancellation idempotency key is required' using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    v_user_id::text || ':' || p_idempotency_key::text,
    0
  ));

  select * into v_existing
  from public.financial_transactions
  where user_id = v_user_id
    and refund_idempotency_key = p_idempotency_key;
  if found then
    if v_existing.transaction_type_code = 'refund_cancellation'
      and v_existing.reverses_transaction_id = p_refund_transaction_id then
      return jsonb_build_object('transaction', to_jsonb(v_existing), 'idempotent', true);
    end if;
    raise exception 'refund cancellation idempotency key was already used with different data'
      using errcode = '23505';
  end if;

  select * into v_refund
  from public.financial_transactions
  where id = p_refund_transaction_id
    and user_id = v_user_id
    and transaction_type_code = 'refund'
    and status = 'posted'
  for update;
  if not found then
    raise exception 'posted refund is not available for cancellation' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.financial_transactions cancellation
    where cancellation.reverses_transaction_id = v_refund.id
  ) then
    raise exception 'refund has already been cancelled' using errcode = '23505';
  end if;

  perform 1
  from public.financial_transactions expense
  where expense.id = v_refund.refunds_transaction_id
    and expense.user_id = v_user_id
    and expense.transaction_type_code = 'expense'
  for update;
  if not found then
    raise exception 'linked expense is not available' using errcode = 'P0002';
  end if;

  select count(*) into v_entry_count
  from public.transaction_entries entry
  where entry.transaction_id = v_refund.id;

  select account.* into v_destination
  from public.transaction_entries entry
  join public.financial_accounts account on account.id = entry.account_id
  where entry.transaction_id = v_refund.id
    and entry.entry_side = 'debit'
    and entry.memo = 'expense_refund_received'
    and account.user_id = v_user_id
    and account.account_type_code in ('cash', 'bank');

  select entry.account_amount into v_amount
  from public.transaction_entries entry
  where entry.transaction_id = v_refund.id
    and entry.account_id = v_destination.id
    and entry.entry_side = 'debit'
    and entry.memo = 'expense_refund_received';

  if v_entry_count <> 2 or v_destination.id is null or not exists (
    select 1 from public.transaction_entries entry
    where entry.transaction_id = v_refund.id
      and entry.account_id is null
      and entry.entry_side = 'credit'
      and entry.memo = 'expense_refund'
      and entry.account_amount = v_amount
  ) then
    raise exception 'transaction is not a supported refund record' using errcode = '22023';
  end if;

  select * into v_destination
  from public.financial_accounts
  where id = v_destination.id and user_id = v_user_id
  for update;

  select v_destination.opening_balance + coalesce(sum(
    case entry.entry_side when 'debit' then entry.account_amount else -entry.account_amount end
  ) filter (where transaction.status = 'posted'), 0)
  into v_destination_balance
  from public.transaction_entries entry
  join public.financial_transactions transaction on transaction.id = entry.transaction_id
  where entry.account_id = v_destination.id and entry.asset_id is null;

  if v_destination_balance < v_amount then
    raise exception 'insufficient available balance to cancel refund' using errcode = 'P0002';
  end if;

  insert into public.financial_transactions (
    user_id, transaction_type_code, transaction_currency_code, status,
    occurred_at, description, notes, main_category_id, subcategory_id,
    reverses_transaction_id, refund_idempotency_key
  ) values (
    v_user_id, 'refund_cancellation', v_refund.transaction_currency_code, 'draft',
    now(), 'Refund cancellation', 'Cancellation of ' || v_refund.id,
    v_refund.main_category_id, v_refund.subcategory_id,
    v_refund.id, p_idempotency_key
  ) returning * into v_transaction;

  insert into public.transaction_entries (
    transaction_id, user_id, account_id, entry_side,
    transaction_amount, account_amount, memo
  ) values (
    v_transaction.id, v_user_id, null, 'debit',
    v_amount, v_amount, 'expense_refund_cancellation'
  ), (
    v_transaction.id, v_user_id, v_destination.id, 'credit',
    v_amount, v_amount, 'expense_refund_cancellation_sent'
  );

  select * into v_transaction from public.post_transaction(v_transaction.id);
  return jsonb_build_object('transaction', to_jsonb(v_transaction), 'idempotent', false);
end;
$$;


ALTER FUNCTION "public"."cancel_expense_refund"("p_refund_transaction_id" "uuid", "p_idempotency_key" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cancel_expense_refund"("p_refund_transaction_id" "uuid", "p_idempotency_key" "uuid") IS 'Posts an idempotent audit-only exact cancellation for one owned effective Refund.';



CREATE OR REPLACE FUNCTION "public"."close_financial_account"("p_account_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."close_financial_account"("p_account_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."close_financial_account"("p_account_id" "uuid") IS 'Closes an owned account only after server-authoritative zero-exposure validation.';



CREATE OR REPLACE FUNCTION "public"."complete_onboarding"("p_country_code" "text", "p_base_currency_code" "text", "p_selected_goals" "text"[]) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  update public.profiles
  set
    country_code = p_country_code,
    base_currency_code = p_base_currency_code,
    selected_goals = p_selected_goals,
    onboarding_completed = true
  where id = (select auth.uid());

  if not found then
    raise exception 'Profile not found for current user';
  end if;
end;
$$;


ALTER FUNCTION "public"."complete_onboarding"("p_country_code" "text", "p_base_currency_code" "text", "p_selected_goals" "text"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."complete_onboarding"("p_country_code" "text", "p_base_currency_code" "text", "p_selected_goals" "text"[]) IS 'Saves the authenticated user''s onboarding selections and marks onboarding complete.';



CREATE OR REPLACE FUNCTION "public"."correct_account_disposal"("p_disposal_id" "uuid", "p_disposed_on" "date", "p_sale_amount" numeric, "p_sale_currency_code" "text", "p_ownership_percentage_sold" numeric, "p_notes" "text" DEFAULT NULL::"text", "p_destination_account_id" "uuid" DEFAULT NULL::"uuid") RETURNS "public"."account_disposals"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_original public.account_disposals%rowtype;
  v_account public.financial_accounts%rowtype;
  v_row public.account_disposals;
  v_replacement_id uuid := gen_random_uuid();
  v_proceeds_transaction_id uuid;
  v_sale_amount numeric(20, 2);
  v_ownership_percentage_sold numeric(5, 2);
begin
  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  if p_sale_amount is null
    or lower(p_sale_amount::text) in ('nan', 'infinity', '-infinity')
    or p_sale_amount < 0
    or p_sale_amount >= 1000000000000000000::numeric
    or p_sale_amount <> trunc(p_sale_amount, 2) then
    raise exception 'Sale amount must be finite, non-negative, and have at most 2 decimal places'
      using errcode = '23514';
  end if;
  v_sale_amount := p_sale_amount;

  select * into v_original
  from public.account_disposals
  where id = p_disposal_id and user_id = auth.uid()
  for update;
  if not found or exists (
    select 1 from public.account_disposals
    where corrects_disposal_id = p_disposal_id
  ) then
    raise exception 'Only an effective owned disposal can be corrected'
      using errcode = '23514';
  end if;
  if v_original.proceeds_transaction_id is not null then
    raise exception 'account_disposal_correction_blocked:allocated_proceeds'
      using errcode = '23514';
  end if;

  select * into v_account
  from public.financial_accounts
  where id = v_original.account_id and user_id = auth.uid()
  for update;
  if not found or v_account.account_type_code not in ('real_estate', 'business') then
    raise exception 'A supported owned account is required' using errcode = '23514';
  end if;
  if p_disposed_on is null or p_disposed_on > current_date
    or p_sale_amount is null
    or p_sale_currency_code not in ('USD', 'SAR', 'EGP', 'EUR', 'GBP', 'AED')
    or p_ownership_percentage_sold is null
    or p_ownership_percentage_sold <= 0 or p_ownership_percentage_sold > 100 then
    raise exception 'Valid non-future disposal fields are required'
      using errcode = '23514';
  end if;
  v_ownership_percentage_sold := p_ownership_percentage_sold;
  if v_sale_amount > 0 and p_destination_account_id is null then
    raise exception 'A destination account is required for positive sale proceeds'
      using errcode = '23514';
  end if;
  if v_sale_amount = 0 and p_destination_account_id is not null then
    raise exception 'A zero-proceeds disposal cannot have a destination account'
      using errcode = '23514';
  end if;

  if v_sale_amount > 0 then
    v_proceeds_transaction_id := public.post_account_disposal_proceeds_internal(
      v_replacement_id, v_account.account_type_code, p_destination_account_id,
      v_sale_amount, p_sale_currency_code, p_disposed_on, p_notes
    );
  end if;

  insert into public.account_disposals (
    id, user_id, account_id, disposed_on, sale_amount, sale_currency_code,
    ownership_percentage_sold, notes, corrects_disposal_id,
    proceeds_account_id, proceeds_transaction_id
  ) values (
    v_replacement_id, auth.uid(), v_original.account_id, p_disposed_on,
    v_sale_amount, p_sale_currency_code, v_ownership_percentage_sold,
    nullif(btrim(p_notes), ''), p_disposal_id,
    case when v_sale_amount > 0 then p_destination_account_id else null end,
    v_proceeds_transaction_id
  ) returning * into v_row;

  perform public.recalculate_account_disposal_projection(v_original.account_id);
  return v_row;
end;
$$;


ALTER FUNCTION "public"."correct_account_disposal"("p_disposal_id" "uuid", "p_disposed_on" "date", "p_sale_amount" numeric, "p_sale_currency_code" "text", "p_ownership_percentage_sold" numeric, "p_notes" "text", "p_destination_account_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."correct_account_disposal"("p_disposal_id" "uuid", "p_disposed_on" "date", "p_sale_amount" numeric, "p_sale_currency_code" "text", "p_ownership_percentage_sold" numeric, "p_notes" "text", "p_destination_account_id" "uuid") IS 'Corrects an effective disposal only when it has no allocated proceeds. V1 blocks allocated-proceeds corrections until atomic reversal semantics exist.';



CREATE OR REPLACE FUNCTION "public"."correct_account_record"("p_transaction_id" "uuid", "p_record_type" "text", "p_account_id" "uuid", "p_counterparty_account_id" "uuid", "p_amount" numeric, "p_received_amount" numeric, "p_occurred_at" timestamp with time zone, "p_category" "text", "p_notes" "text", "p_main_category_id" "uuid" DEFAULT NULL::"uuid", "p_subcategory_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_original public.financial_transactions%rowtype;
  v_category_label text;
  v_reversal jsonb;
  v_replacement jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_original
  from public.financial_transactions
  where id = p_transaction_id
    and user_id = v_user_id
    and status = 'posted'
    and transaction_type_code in ('income', 'expense', 'transfer')
  for update;
  if not found then
    raise exception 'posted account record is not available for correction' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.financial_transactions
    where reverses_transaction_id = v_original.id
  ) then
    raise exception 'reversed account record cannot be corrected' using errcode = '23505';
  end if;
  if exists (
    select 1
    from public.financial_transactions
    where corrects_transaction_id = v_original.id
  ) then
    raise exception 'account record has already been corrected' using errcode = '23505';
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

  -- A PL/pgSQL function runs in the caller's transaction. Any error from the
  -- reversal or replacement helper rolls back both newly-created transactions.
  v_reversal := public.reverse_account_record(v_original.id);
  v_replacement := public.post_account_record_internal(
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
    v_original.id
  );

  return jsonb_build_object(
    'reversal', v_reversal -> 'transaction',
    'transaction', v_replacement -> 'transaction'
  );
end;
$$;


ALTER FUNCTION "public"."correct_account_record"("p_transaction_id" "uuid", "p_record_type" "text", "p_account_id" "uuid", "p_counterparty_account_id" "uuid", "p_amount" numeric, "p_received_amount" numeric, "p_occurred_at" timestamp with time zone, "p_category" "text", "p_notes" "text", "p_main_category_id" "uuid", "p_subcategory_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."correct_account_record"("p_transaction_id" "uuid", "p_record_type" "text", "p_account_id" "uuid", "p_counterparty_account_id" "uuid", "p_amount" numeric, "p_received_amount" numeric, "p_occurred_at" timestamp with time zone, "p_category" "text", "p_notes" "text", "p_main_category_id" "uuid", "p_subcategory_id" "uuid") IS 'Atomically creates an immutable reversal of an owned posted Account Record and a linked replacement.';



CREATE OR REPLACE FUNCTION "public"."correct_account_valuation"("p_valuation_id" "uuid", "p_valuation_amount" numeric, "p_valued_on" "date", "p_valuation_method" "text" DEFAULT NULL::"text", "p_notes" "text" DEFAULT NULL::"text") RETURNS "public"."account_valuations"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_original public.account_valuations;
  v_account public.financial_accounts;
  v_row public.account_valuations;
  v_whitespace constant text := E' \t\n\r\f' || chr(11) || U&'\0085\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000';
  v_method text := nullif(btrim(coalesce(p_valuation_method, ''), v_whitespace), '');
  v_custom_method text;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Authentication is required'; end if;
  select * into v_original from public.account_valuations where id = p_valuation_id and user_id = auth.uid() for update;
  if not found or exists (select 1 from public.account_valuations where corrects_valuation_id = p_valuation_id) then
    raise exception using errcode = '23514', message = 'Only an effective owned valuation can be corrected';
  end if;
  select * into v_account from public.financial_accounts where id = v_original.account_id and user_id = auth.uid() for update;
  if not found or v_account.account_type_code not in ('real_estate', 'business') then
    raise exception using errcode = '23514', message = 'A supported owned account is required';
  end if;
  if p_valuation_amount is null or p_valuation_amount < 0 or p_valued_on is null or p_valued_on > current_date then
    raise exception using errcode = '23514', message = 'A non-negative non-future valuation amount and valuation date are required';
  end if;
  if v_method like 'other:%' then
    v_custom_method := btrim(substring(v_method from 7), v_whitespace);
    if nullif(v_custom_method, '') is null then
      raise exception using errcode = '23514', message = case
        when v_account.account_type_code = 'business' then 'A supported Business valuation method is required'
        else 'A supported Real Estate valuation method is required'
      end;
    end if;
    v_method := 'other:' || v_custom_method;
  elsif v_account.account_type_code = 'business' and v_method is not null
    and v_method not in (
      'owner_estimate', 'professional_appraisal', 'market_comparison',
      'revenue_multiple', 'ebitda_multiple', 'discounted_cash_flow',
      'asset_based', 'recent_transaction'
    ) then
    raise exception using errcode = '23514', message = 'A supported Business valuation method is required';
  elsif v_account.account_type_code = 'real_estate' and v_method is not null
    and v_method not in (
      'owner_estimate', 'professional_appraisal', 'market_comparison',
      'income_approach', 'cost_approach', 'recent_transaction'
    ) then
    raise exception using errcode = '23514', message = 'A supported Real Estate valuation method is required';
  end if;
  insert into public.account_valuations (user_id, account_id, valuation_amount, valued_on, valuation_method, notes, corrects_valuation_id)
  values (auth.uid(), v_original.account_id, p_valuation_amount, p_valued_on,
    v_method, nullif(btrim(p_notes), ''), p_valuation_id) returning * into v_row;
  return v_row;
end;
$$;


ALTER FUNCTION "public"."correct_account_valuation"("p_valuation_id" "uuid", "p_valuation_amount" numeric, "p_valued_on" "date", "p_valuation_method" "text", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."correct_existing_holding"("p_original_transaction_id" "uuid", "p_quantity" numeric, "p_average_cost" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_account_fx_rate" numeric) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_original public.financial_transactions%rowtype;
  v_asset_entry public.transaction_entries%rowtype;
  v_reversal_result jsonb;
  v_replacement_result jsonb;
  v_holding public.holdings%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_original
  from public.financial_transactions as transactions
  where transactions.id = p_original_transaction_id
    and transactions.user_id = v_user_id
    and transactions.transaction_type_code = 'opening_position'
    and transactions.status = 'posted'
  for update;
  if not found then
    raise exception 'posted existing holding is not available for correction' using errcode = 'P0002';
  end if;
  if exists (
    select 1
    from public.financial_transactions as transactions
    where transactions.reverses_transaction_id = v_original.id
       or transactions.corrects_transaction_id = v_original.id
  ) then
    raise exception 'existing holding has already been changed' using errcode = '23505';
  end if;

  select * into strict v_asset_entry
  from public.transaction_entries as entries
  where entries.transaction_id = v_original.id
    and entries.user_id = v_user_id
    and entries.memo = 'existing_holding_asset';

  -- reverse_existing_holding acquires the per-holding advisory lock, validates
  -- the exact immutable shape, and preflights the resulting projection before
  -- it creates any draft. A later error rolls this entire function back.
  v_reversal_result := public.reverse_existing_holding(v_original.id);
  v_replacement_result := public.post_existing_holding_with_links_internal(
    v_asset_entry.account_id,
    v_asset_entry.asset_id,
    p_quantity,
    p_average_cost,
    p_occurred_at,
    p_notes,
    p_account_fx_rate,
    v_original.id
  );

  select * into v_holding
  from public.holdings as holdings
  where holdings.user_id = v_user_id
    and holdings.account_id = v_asset_entry.account_id
    and holdings.asset_id = v_asset_entry.asset_id;

  return pg_catalog.jsonb_build_object(
    'original_transaction', pg_catalog.to_jsonb(v_original),
    'reversal_transaction', v_reversal_result -> 'reversal_transaction',
    'reversal_entries', v_reversal_result -> 'entries',
    'replacement_transaction', v_replacement_result -> 'transaction',
    'replacement_entries', v_replacement_result -> 'entries',
    'holding', pg_catalog.to_jsonb(v_holding)
  );
exception
  when no_data_found or too_many_rows then
    raise exception 'existing holding does not contain the expected immutable ledger shape'
      using errcode = '23514';
end;
$$;


ALTER FUNCTION "public"."correct_existing_holding"("p_original_transaction_id" "uuid", "p_quantity" numeric, "p_average_cost" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_account_fx_rate" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."correct_existing_holding"("p_original_transaction_id" "uuid", "p_quantity" numeric, "p_average_cost" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_account_fx_rate" numeric) IS 'Atomically corrects an owned posted Existing Holding opening position by posting its exact immutable reversal and linked replacement. Quantity is canonical; average cost is in the asset currency; no Brokerage cash movement is created.';



CREATE OR REPLACE FUNCTION "public"."correct_goal_progress_entry"("p_entry_id" "uuid", "p_replacement_amount" numeric DEFAULT NULL::numeric, "p_replacement_effective_on" "date" DEFAULT NULL::"date", "p_note" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_user_id uuid := auth.uid(); v_original public.goal_progress_entries%rowtype; v_goal public.goals%rowtype; v_replacement_id uuid;
begin
  select * into v_original from public.goal_progress_entries where id=p_entry_id and user_id=v_user_id and entry_type in ('progress','withdrawal') for update;
  if not found then raise exception 'Correctable entry not found'; end if;
  select * into v_goal from public.goals where id=v_original.goal_id and user_id=v_user_id for update;
  if v_goal.status <> 'active' or v_goal.archived_at is not null then raise exception 'Goal must be active and unarchived'; end if;
  if exists(select 1 from public.goal_progress_entries where reverses_entry_id=p_entry_id) then raise exception 'Entry already reversed'; end if;
  if p_replacement_amount is not null and p_replacement_amount <= 0 then raise exception 'Replacement amount must be positive'; end if;
  if p_replacement_amount is not null and p_replacement_effective_on is null then raise exception 'Replacement date is required'; end if;
  if p_replacement_effective_on > current_date then raise exception 'Progress date cannot be in the future'; end if;
  insert into public.goal_progress_entries(goal_id,user_id,entry_type,amount,effective_on,note,reverses_entry_id)
  values(v_original.goal_id,v_user_id,'reversal',v_original.amount,v_original.effective_on,nullif(btrim(p_note),''),v_original.id);
  if p_replacement_amount is not null then
    insert into public.goal_progress_entries(goal_id,user_id,entry_type,amount,effective_on,note,replacement_for_entry_id)
    values(v_original.goal_id,v_user_id,v_original.entry_type,p_replacement_amount,p_replacement_effective_on,nullif(btrim(p_note),''),v_original.id) returning id into v_replacement_id;
  end if;
  if public.goal_funded_amount(v_original.goal_id) < 0 then raise exception 'Correction would make funded amount negative'; end if;
  return v_replacement_id;
end; $$;


ALTER FUNCTION "public"."correct_goal_progress_entry"("p_entry_id" "uuid", "p_replacement_amount" numeric, "p_replacement_effective_on" "date", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."correct_metal_purchase"("p_purchase_id" "uuid", "p_purity" "text", "p_occurred_at" timestamp with time zone, "p_quantity_grams" numeric, "p_cost_per_unit" numeric, "p_funding_mode" "text", "p_funding_account_id" "uuid", "p_fees" numeric, "p_notes" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_original public.metal_purchases%rowtype;
  v_replacement public.metal_purchases%rowtype;
  v_funding_reversal_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;
  select * into v_original
  from public.metal_purchases
  where id = p_purchase_id and user_id = v_user_id
  for update;
  if not found then
    raise exception 'metal purchase is not available for correction' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.metal_purchase_lifecycle_events
    where affected_purchase_id = v_original.id
  ) then
    raise exception 'metal purchase has already been reversed or corrected' using errcode = '23505';
  end if;

  -- Serialize all current and replacement funding balance checks in a stable
  -- order before the per-account row locks in the helpers below.
  if p_funding_account_id is not null
    and (v_original.funding_account_id is null or p_funding_account_id::text < v_original.funding_account_id::text) then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(p_funding_account_id::text, 0)
    );
  end if;
  if v_original.funding_account_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_original.funding_account_id::text, 0)
    );
  end if;
  if p_funding_account_id is not null
    and v_original.funding_account_id is not null
    and p_funding_account_id::text > v_original.funding_account_id::text then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(p_funding_account_id::text, 0)
    );
  end if;

  v_funding_reversal_id := public.reverse_metal_purchase_funding_internal(v_user_id, v_original);
  select * into v_replacement
  from public.create_metal_purchase_internal(
    v_user_id, v_original.account_id, p_purity, p_occurred_at, p_quantity_grams,
    p_cost_per_unit, p_funding_mode, p_funding_account_id, p_fees, p_notes,
    v_original.funding_transaction_id
  );

  insert into public.metal_purchase_lifecycle_events (
    user_id, affected_purchase_id, action, replacement_purchase_id,
    funding_reversal_transaction_id
  ) values (
    v_user_id, v_original.id, 'correction', v_replacement.id, v_funding_reversal_id
  );
  perform public.recalculate_metal_purchase_account_internal(v_user_id, v_original.account_id);

  return jsonb_build_object(
    'corrected_purchase_id', v_original.id,
    'replacement_purchase_id', v_replacement.id,
    'funding_reversal_transaction_id', v_funding_reversal_id
  );
end;
$$;


ALTER FUNCTION "public"."correct_metal_purchase"("p_purchase_id" "uuid", "p_purity" "text", "p_occurred_at" timestamp with time zone, "p_quantity_grams" numeric, "p_cost_per_unit" numeric, "p_funding_mode" "text", "p_funding_account_id" "uuid", "p_fees" numeric, "p_notes" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."correct_metal_purchase"("p_purchase_id" "uuid", "p_purity" "text", "p_occurred_at" timestamp with time zone, "p_quantity_grams" numeric, "p_cost_per_unit" numeric, "p_funding_mode" "text", "p_funding_account_id" "uuid", "p_fees" numeric, "p_notes" "text") IS 'Atomically records an immutable correction, reverses prior linked funding, creates the replacement purchase, and recomputes derived metal account fields.';



CREATE OR REPLACE FUNCTION "public"."create_goal"("p_name" "text", "p_goal_type" "text", "p_custom_type_name" "text", "p_target_amount" numeric, "p_currency_code" "text", "p_target_date" "date", "p_saved_so_far" numeric DEFAULT NULL::numeric, "p_saved_on" "date" DEFAULT NULL::"date") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_user_id uuid := auth.uid(); v_goal_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_saved_so_far is not null and p_saved_so_far <= 0 then raise exception 'Saved so far must be positive'; end if;
  if p_saved_so_far is not null and coalesce(p_saved_on, current_date) > current_date then raise exception 'Progress date cannot be in the future'; end if;
  insert into public.goals(user_id,name,goal_type,custom_type_name,target_amount,currency_code,target_date)
  values(v_user_id,btrim(p_name),p_goal_type,case when p_goal_type='other' then nullif(btrim(p_custom_type_name),'') else null end,p_target_amount,p_currency_code,p_target_date)
  returning id into v_goal_id;
  if p_saved_so_far is not null then
    insert into public.goal_progress_entries(goal_id,user_id,entry_type,amount,effective_on)
    values(v_goal_id,v_user_id,'progress',p_saved_so_far,coalesce(p_saved_on,current_date));
  end if;
  return v_goal_id;
end; $$;


ALTER FUNCTION "public"."create_goal"("p_name" "text", "p_goal_type" "text", "p_custom_type_name" "text", "p_target_amount" numeric, "p_currency_code" "text", "p_target_date" "date", "p_saved_so_far" numeric, "p_saved_on" "date") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."metal_purchases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "purity" "text" NOT NULL,
    "purchased_at" timestamp with time zone NOT NULL,
    "quantity_grams" numeric(20,3) NOT NULL,
    "cost_per_unit" numeric(20,2) NOT NULL,
    "fees" numeric(20,2) DEFAULT 0 NOT NULL,
    "funding_mode" "text" NOT NULL,
    "funding_account_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes" "text",
    "funding_transaction_id" "uuid",
    CONSTRAINT "metal_purchases_cost_per_unit_check" CHECK (("cost_per_unit" > (0)::numeric)),
    CONSTRAINT "metal_purchases_fees_check" CHECK (("fees" >= (0)::numeric)),
    CONSTRAINT "metal_purchases_funding_account_check" CHECK (((("funding_mode" = 'cash_account'::"text") AND ("funding_account_id" IS NOT NULL) AND ("funding_transaction_id" IS NOT NULL)) OR (("funding_mode" = 'external'::"text") AND ("funding_account_id" IS NULL) AND ("funding_transaction_id" IS NULL)))),
    CONSTRAINT "metal_purchases_funding_mode_check" CHECK (("funding_mode" = ANY (ARRAY['external'::"text", 'cash_account'::"text"]))),
    CONSTRAINT "metal_purchases_quantity_grams_check" CHECK (("quantity_grams" > (0)::numeric))
);


ALTER TABLE "public"."metal_purchases" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_metal_purchase_internal"("p_user_id" "uuid", "p_account_id" "uuid", "p_purity" "text", "p_occurred_at" timestamp with time zone, "p_quantity_grams" numeric, "p_cost_per_unit" numeric, "p_funding_mode" "text", "p_funding_account_id" "uuid", "p_fees" numeric, "p_notes" "text", "p_corrects_funding_transaction_id" "uuid" DEFAULT NULL::"uuid") RETURNS "public"."metal_purchases"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_account public.financial_accounts%rowtype;
  v_funding_account public.financial_accounts%rowtype;
  v_funding_transaction public.financial_transactions%rowtype;
  v_purchase public.metal_purchases%rowtype;
  v_purity text := lower(pg_catalog.btrim(p_purity));
  v_fee_amount numeric := coalesce(p_fees, 0::numeric);
  v_notes text := nullif(pg_catalog.btrim(p_notes), '');
  v_cost_basis numeric;
  v_available_funding numeric;
begin
  if p_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  select * into v_account
  from public.financial_accounts
  where id = p_account_id
    and user_id = p_user_id
    and account_type_code = 'gold'
    and metal_type in ('gold', 'silver')
    and is_active
  for update;
  if not found then
    raise exception 'active owned Gold/Silver account % does not exist', p_account_id
      using errcode = 'P0002';
  end if;

  if p_occurred_at is null then
    raise exception 'purchase date and time is required' using errcode = '22023';
  end if;
  if p_quantity_grams is null or p_quantity_grams <= 0 then
    raise exception 'grams must be positive' using errcode = '22023';
  end if;
  if p_cost_per_unit is null or p_cost_per_unit <= 0 then
    raise exception 'cost per unit must be positive' using errcode = '22023';
  end if;
  if v_fee_amount < 0 then
    raise exception 'fees cannot be negative' using errcode = '22023';
  end if;
  if v_account.metal_type = 'gold'
    and v_purity not in ('24k', '22k', '21k', '18k', '14k', '10k', '9k', 'other') then
    raise exception 'purity % is not valid for gold', p_purity using errcode = '22023';
  elsif v_account.metal_type = 'silver'
    and v_purity not in ('999', '958', '950', '925', '900', '835', '800', 'other') then
    raise exception 'purity % is not valid for silver', p_purity using errcode = '22023';
  end if;

  v_cost_basis := p_quantity_grams * p_cost_per_unit + v_fee_amount;

  if p_funding_mode = 'cash_account' then
    if p_funding_account_id is null then
      raise exception 'a funding cash account is required' using errcode = '22023';
    end if;

    select * into v_funding_account
    from public.financial_accounts
    where id = p_funding_account_id
      and user_id = p_user_id
      and is_active
      and account_type_code in ('cash', 'bank')
    for update;
    if not found then
      raise exception 'selected funding account is not available' using errcode = '42501';
    end if;
    if v_funding_account.currency_code <> v_account.currency_code then
      raise exception 'funding account currency must match the Gold/Silver account currency'
        using errcode = '22023';
    end if;

    select v_funding_account.opening_balance + coalesce(sum(
      case entry.entry_side when 'debit' then entry.account_amount else -entry.account_amount end
    ) filter (where transaction.status = 'posted'), 0::numeric)
    into v_available_funding
    from public.transaction_entries as entry
    join public.financial_transactions as transaction on transaction.id = entry.transaction_id
    where entry.account_id = v_funding_account.id
      and entry.asset_id is null;
    if v_available_funding < v_cost_basis then
      raise exception 'insufficient funding account balance' using errcode = 'P0002';
    end if;

    insert into public.financial_transactions (
      user_id, transaction_type_code, transaction_currency_code, status,
      occurred_at, description, notes, corrects_transaction_id
    ) values (
      p_user_id, 'investment_purchase', v_account.currency_code, 'draft',
      p_occurred_at, initcap(v_account.metal_type) || ' purchase', v_notes,
      p_corrects_funding_transaction_id
    ) returning * into v_funding_transaction;

    insert into public.transaction_entries (
      transaction_id, user_id, account_id, entry_side, transaction_amount, account_amount, memo
    ) values (
      v_funding_transaction.id, p_user_id, null, 'debit', v_cost_basis, v_cost_basis,
      'metal_purchase_funding'
    ), (
      v_funding_transaction.id, p_user_id, v_funding_account.id, 'credit', v_cost_basis,
      v_cost_basis, 'metal_purchase_funding'
    );
    select * into v_funding_transaction from public.post_transaction(v_funding_transaction.id);
  elsif p_funding_mode = 'external' then
    if p_funding_account_id is not null then
      raise exception 'external funding cannot specify a funding account' using errcode = '22023';
    end if;
    p_funding_account_id := null;
  else
    raise exception 'funding mode must be external or cash_account' using errcode = '22023';
  end if;

  insert into public.metal_purchases (
    user_id, account_id, purity, purchased_at, quantity_grams, cost_per_unit,
    fees, funding_mode, funding_account_id, funding_transaction_id, notes
  ) values (
    p_user_id, v_account.id, v_purity, p_occurred_at, p_quantity_grams, p_cost_per_unit,
    v_fee_amount, p_funding_mode, p_funding_account_id,
    case when p_funding_mode = 'cash_account' then v_funding_transaction.id else null end,
    v_notes
  ) returning * into v_purchase;

  return v_purchase;
end;
$$;


ALTER FUNCTION "public"."create_metal_purchase_internal"("p_user_id" "uuid", "p_account_id" "uuid", "p_purity" "text", "p_occurred_at" timestamp with time zone, "p_quantity_grams" numeric, "p_cost_per_unit" numeric, "p_funding_mode" "text", "p_funding_account_id" "uuid", "p_fees" numeric, "p_notes" "text", "p_corrects_funding_transaction_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_valued_account"("p_account_type_code" "text", "p_name" "text", "p_currency_code" "text", "p_property_type" "text", "p_business_type" "text", "p_industry" "text", "p_ownership_percentage" numeric, "p_location" "text", "p_account_notes" "text", "p_valuation_amount" numeric, "p_valued_on" "date", "p_valuation_method" "text", "p_valuation_notes" "text") RETURNS "public"."financial_accounts"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_account public.financial_accounts;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Authentication is required'; end if;
  if p_account_type_code not in ('real_estate', 'business') or nullif(btrim(p_name), '') is null
    or p_currency_code not in ('USD', 'SAR', 'EGP', 'EUR', 'GBP', 'AED')
    or p_ownership_percentage is null or p_ownership_percentage < 0 or p_ownership_percentage > 100
    or p_valuation_amount is null or p_valuation_amount < 0 or p_valued_on is null then
    raise exception using errcode = '23514', message = 'Valid account and valuation fields are required';
  end if;
  if p_account_type_code = 'real_estate' and p_property_type not in ('apartment', 'villa', 'land', 'office', 'other') then raise exception using errcode = '23514', message = 'A property type is required'; end if;
  if p_account_type_code = 'business' and (nullif(btrim(p_business_type), '') is null or nullif(btrim(p_industry), '') is null) then raise exception using errcode = '23514', message = 'Business type and industry are required'; end if;
  insert into public.financial_accounts (user_id, account_type_code, name, currency_code, opening_balance, notes, property_type, ownership_percentage, initial_ownership_percentage, business_type, industry, location)
  values (auth.uid(), p_account_type_code, btrim(p_name), p_currency_code, 0, nullif(btrim(p_account_notes), ''),
    case when p_account_type_code = 'real_estate' then p_property_type else null end, p_ownership_percentage, p_ownership_percentage,
    case when p_account_type_code = 'business' then nullif(btrim(p_business_type), '') else null end,
    case when p_account_type_code = 'business' then nullif(btrim(p_industry), '') else null end,
    case when p_account_type_code = 'real_estate' then nullif(btrim(p_location), '') else null end) returning * into v_account;
  perform public.add_account_valuation(v_account.id, p_valuation_amount, p_valued_on, p_valuation_method, p_valuation_notes);
  return v_account;
end;
$$;


ALTER FUNCTION "public"."create_valued_account"("p_account_type_code" "text", "p_name" "text", "p_currency_code" "text", "p_property_type" "text", "p_business_type" "text", "p_industry" "text", "p_ownership_percentage" numeric, "p_location" "text", "p_account_notes" "text", "p_valuation_amount" numeric, "p_valued_on" "date", "p_valuation_method" "text", "p_valuation_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_goal"("p_goal_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_goal public.goals%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_goal
  from public.goals
  where id = p_goal_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Goal not found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.goal_progress_entries
    where goal_id = v_goal.id
  ) then
    raise exception 'Goal with progress history cannot be deleted' using errcode = '23514';
  end if;

  delete from public.goals
  where id = v_goal.id and user_id = v_user_id;
end;
$$;


ALTER FUNCTION "public"."delete_goal"("p_goal_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."delete_goal"("p_goal_id" "uuid") IS 'Permanently deletes one owned Goal only when it has no raw progress history rows.';



CREATE OR REPLACE FUNCTION "public"."delete_pristine_financial_account"("p_account_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."delete_pristine_financial_account"("p_account_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."delete_pristine_financial_account"("p_account_id" "uuid") IS 'Hard-deletes only an owned, zero-exposure account with no dependent financial history.';



CREATE OR REPLACE FUNCTION "public"."export_my_data_v1"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_claimed uuid;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  insert into public.user_data_export_rate_limits (user_id, last_requested_at)
  values (v_user_id, pg_catalog.statement_timestamp())
  on conflict (user_id) do update
    set last_requested_at = excluded.last_requested_at
    where user_data_export_rate_limits.last_requested_at
      <= excluded.last_requested_at - interval '60 seconds'
  returning user_id into v_claimed;

  if v_claimed is null then
    raise exception 'export_rate_limited' using errcode = 'P0001';
  end if;

  select pg_catalog.jsonb_build_object(
    'schema', 'tharwati.user-data-export',
    'version', 1,
    'subject', pg_catalog.jsonb_build_object('user_id', v_user_id),
    'data', pg_catalog.jsonb_build_object(
      'profile', coalesce((
        select pg_catalog.jsonb_build_object(
          'id', p.id, 'full_name', p.full_name, 'avatar_url', p.avatar_url,
          'country_code', p.country_code, 'base_currency_code', p.base_currency_code,
          'selected_goals', p.selected_goals,
          'onboarding_completed', p.onboarding_completed,
          'created_at', p.created_at, 'updated_at', p.updated_at
        ) from public.profiles p where p.id = v_user_id
      ), 'null'::jsonb),
      'financial_accounts', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', a.id, 'user_id', a.user_id, 'account_type_code', a.account_type_code,
          'name', a.name, 'currency_code', a.currency_code,
          'opening_balance', a.opening_balance::text, 'is_active', a.is_active,
          'notes', a.notes, 'bank_subtype', a.bank_subtype,
          'credit_card_limit', case when a.credit_card_limit is null then null else a.credit_card_limit::text end,
          'due_day_of_month', a.due_day_of_month, 'investment_type', a.investment_type,
          'balance_grams', case when a.balance_grams is null then null else a.balance_grams::text end,
          'property_type', a.property_type,
          'ownership_percentage', case when a.ownership_percentage is null then null else a.ownership_percentage::text end,
          'initial_ownership_percentage', case when a.initial_ownership_percentage is null then null else a.initial_ownership_percentage::text end,
          'closed_on', a.closed_on, 'closed_reason', a.closed_reason,
          'business_type', a.business_type, 'industry', a.industry, 'location', a.location,
          'metal_type', a.metal_type, 'purity', a.purity, 'purchase_date', a.purchase_date,
          'cost_per_unit', case when a.cost_per_unit is null then null else a.cost_per_unit::text end,
          'created_at', a.created_at, 'updated_at', a.updated_at
        ) order by a.created_at, a.id)
        from public.financial_accounts a where a.user_id = v_user_id
      ), '[]'::jsonb),
      'financial_transactions', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', t.id, 'user_id', t.user_id, 'transaction_type_code', t.transaction_type_code,
          'transaction_currency_code', t.transaction_currency_code, 'status', t.status,
          'occurred_at', t.occurred_at, 'description', t.description,
          'external_reference', t.external_reference, 'notes', t.notes,
          'main_category_id', t.main_category_id, 'subcategory_id', t.subcategory_id,
          'posted_at', t.posted_at, 'reverses_transaction_id', t.reverses_transaction_id,
          'corrects_transaction_id', t.corrects_transaction_id,
          'created_at', t.created_at, 'updated_at', t.updated_at
        ) order by t.occurred_at, t.created_at, t.id)
        from public.financial_transactions t where t.user_id = v_user_id
      ), '[]'::jsonb),
      'transaction_entries', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', e.id, 'transaction_id', e.transaction_id, 'user_id', e.user_id,
          'account_id', e.account_id, 'asset_id', e.asset_id, 'entry_side', e.entry_side,
          'transaction_amount', e.transaction_amount::text, 'account_amount', e.account_amount::text,
          'quantity_delta', case when e.quantity_delta is null then null else e.quantity_delta::text end,
          'input_quantity', case when e.input_quantity is null then null else e.input_quantity::text end,
          'input_quantity_unit', e.input_quantity_unit,
          'quantity_conversion_factor', case when e.quantity_conversion_factor is null then null else e.quantity_conversion_factor::text end,
          'cost_basis_delta', case when e.cost_basis_delta is null then null else e.cost_basis_delta::text end,
          'account_cost_basis_delta', case when e.account_cost_basis_delta is null then null else e.account_cost_basis_delta::text end,
          'account_fx_rate', case when e.account_fx_rate is null then null else e.account_fx_rate::text end,
          'account_fx_effective_at', e.account_fx_effective_at, 'account_fx_source', e.account_fx_source,
          'unit_price', case when e.unit_price is null then null else e.unit_price::text end,
          'memo', e.memo, 'purity', e.purity, 'created_at', e.created_at, 'updated_at', e.updated_at
        ) order by e.transaction_id, e.created_at, e.id)
        from public.transaction_entries e where e.user_id = v_user_id
      ), '[]'::jsonb),
      'holdings', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', h.id, 'user_id', h.user_id, 'account_id', h.account_id, 'asset_id', h.asset_id,
          'quantity', h.quantity::text,
          'average_cost', case when h.average_cost is null then null else h.average_cost::text end,
          'total_cost_basis', h.total_cost_basis::text, 'cost_currency_code', h.cost_currency_code,
          'notes', h.notes, 'created_at', h.created_at, 'updated_at', h.updated_at
        ) order by h.account_id, h.asset_id, h.id)
        from public.holdings h where h.user_id = v_user_id
      ), '[]'::jsonb),
      'user_assets', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', a.id, 'user_id', a.user_id, 'asset_type_code', a.asset_type_code,
          'symbol', a.symbol, 'name', a.name, 'currency_code', a.currency_code,
          'exchange', a.exchange, 'is_custom', a.is_custom, 'is_active', a.is_active,
          'canonical_quantity_unit', a.canonical_quantity_unit,
          'created_at', a.created_at, 'updated_at', a.updated_at
        ) order by a.created_at, a.id)
        from public.assets a where a.user_id = v_user_id
      ), '[]'::jsonb),
      'asset_identifiers', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', i.id, 'asset_id', i.asset_id, 'user_id', i.user_id, 'scheme', i.scheme,
          'namespace', i.namespace, 'value', i.value, 'normalized_value', i.normalized_value,
          'provider', i.provider, 'is_primary', i.is_primary,
          'created_at', i.created_at, 'updated_at', i.updated_at
        ) order by i.asset_id, i.is_primary desc, i.scheme, i.namespace, i.normalized_value, i.id)
        from public.asset_identifiers i where i.user_id = v_user_id
      ), '[]'::jsonb),
      'metal_purchases', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', m.id, 'user_id', m.user_id, 'account_id', m.account_id, 'purity', m.purity,
          'purchased_at', m.purchased_at, 'quantity_grams', m.quantity_grams::text,
          'cost_per_unit', m.cost_per_unit::text, 'fees', m.fees::text, 'notes', m.notes,
          'funding_mode', m.funding_mode, 'funding_account_id', m.funding_account_id,
          'funding_transaction_id', m.funding_transaction_id, 'created_at', m.created_at
        ) order by m.purchased_at, m.created_at, m.id)
        from public.metal_purchases m where m.user_id = v_user_id
      ), '[]'::jsonb),
      'metal_purchase_lifecycle_events', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', l.id, 'user_id', l.user_id, 'affected_purchase_id', l.affected_purchase_id,
          'action', l.action, 'replacement_purchase_id', l.replacement_purchase_id,
          'funding_reversal_transaction_id', l.funding_reversal_transaction_id,
          'created_at', l.created_at
        ) order by l.created_at, l.id)
        from public.metal_purchase_lifecycle_events l where l.user_id = v_user_id
      ), '[]'::jsonb),
      'account_valuations', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', v.id, 'user_id', v.user_id, 'account_id', v.account_id,
          'valuation_amount', v.valuation_amount::text, 'valued_on', v.valued_on,
          'valuation_method', v.valuation_method, 'notes', v.notes,
          'corrects_valuation_id', v.corrects_valuation_id, 'created_at', v.created_at
        ) order by v.account_id, v.valued_on, v.created_at, v.id)
        from public.account_valuations v where v.user_id = v_user_id
      ), '[]'::jsonb),
      'account_disposals', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', d.id, 'user_id', d.user_id, 'account_id', d.account_id,
          'disposed_on', d.disposed_on, 'sale_amount', d.sale_amount::text,
          'sale_currency_code', d.sale_currency_code,
          'ownership_percentage_sold', d.ownership_percentage_sold::text,
          'notes', d.notes, 'corrects_disposal_id', d.corrects_disposal_id,
          'idempotency_key', d.idempotency_key, 'proceeds_account_id', d.proceeds_account_id,
          'proceeds_transaction_id', d.proceeds_transaction_id, 'created_at', d.created_at
        ) order by d.account_id, d.disposed_on, d.created_at, d.id)
        from public.account_disposals d where d.user_id = v_user_id
      ), '[]'::jsonb),
      'record_categories', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', c.id, 'user_id', c.user_id, 'parent_id', c.parent_id,
          'system_code', c.system_code, 'level', c.level, 'name', c.name,
          'sort_order', c.sort_order, 'is_archived', c.is_archived,
          'created_at', c.created_at, 'updated_at', c.updated_at
        ) order by c.level, c.sort_order, c.created_at, c.id)
        from public.record_categories c where c.user_id = v_user_id
      ), '[]'::jsonb),
      'record_category_overrides', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'user_id', o.user_id, 'category_id', o.category_id, 'name', o.name,
          'is_hidden', o.is_hidden, 'created_at', o.created_at, 'updated_at', o.updated_at
        ) order by o.category_id)
        from public.record_category_overrides o where o.user_id = v_user_id
      ), '[]'::jsonb),
      'goals', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', g.id, 'user_id', g.user_id, 'name', g.name, 'goal_type', g.goal_type,
          'custom_type_name', g.custom_type_name, 'target_amount', g.target_amount::text,
          'currency_code', g.currency_code, 'target_date', g.target_date, 'status', g.status,
          'archived_at', g.archived_at, 'created_at', g.created_at, 'updated_at', g.updated_at
        ) order by g.created_at, g.id)
        from public.goals g where g.user_id = v_user_id
      ), '[]'::jsonb),
      'goal_progress_entries', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', p.id, 'goal_id', p.goal_id, 'user_id', p.user_id,
          'entry_type', p.entry_type, 'amount', p.amount::text, 'effective_on', p.effective_on,
          'note', p.note, 'reverses_entry_id', p.reverses_entry_id,
          'replacement_for_entry_id', p.replacement_for_entry_id, 'created_at', p.created_at
        ) order by p.goal_id, p.effective_on, p.created_at, p.id)
        from public.goal_progress_entries p where p.user_id = v_user_id
      ), '[]'::jsonb),
      'manual_market_prices', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', m.id, 'user_id', m.user_id, 'asset_id', m.asset_id, 'provider', m.provider,
          'price', m.price::text, 'currency_code', m.currency_code, 'as_of', m.as_of,
          'fetched_at', m.fetched_at, 'price_type', m.price_type,
          'created_at', m.created_at, 'updated_at', m.updated_at
        ) order by m.asset_id, m.as_of, m.created_at, m.id)
        from public.market_prices m
        where m.user_id = v_user_id and m.provider = 'manual' and m.price_type = 'manual'
      ), '[]'::jsonb)
    )
  ) into v_result;

  return v_result;
end;
$$;


ALTER FUNCTION "public"."export_my_data_v1"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."export_my_data_v1"() IS 'Returns the authenticated caller own source/audit records as deterministic Tharwati user-data export v1 JSON; limited to one request per minute.';



CREATE OR REPLACE FUNCTION "public"."get_account_balances"("p_account_ids" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS TABLE("account_id" "uuid", "account_type_code" "text", "account_name" "text", "currency_code" "text", "is_active" boolean, "opening_balance" "text", "ledger_effect" "text", "current_balance" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."get_account_balances"("p_account_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_account_current_ownership"("p_account_ids" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS TABLE("account_id" "uuid", "ownership_percentage" numeric, "is_sold" boolean)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select account.id,
    case when account.initial_ownership_percentage is null then null
      else account.initial_ownership_percentage - coalesce(sum(disposal.ownership_percentage_sold), 0) end,
    case when account.initial_ownership_percentage is null then false
      else account.initial_ownership_percentage - coalesce(sum(disposal.ownership_percentage_sold), 0) = 0 end
  from public.financial_accounts account
  left join public.account_disposals disposal
    on disposal.account_id = account.id
    and not exists (select 1 from public.account_disposals correction where correction.corrects_disposal_id = disposal.id)
  where account.user_id = (select auth.uid())
    and account.account_type_code in ('real_estate', 'business')
    and (p_account_ids is null or account.id = any(p_account_ids))
  group by account.id, account.initial_ownership_percentage;
$$;


ALTER FUNCTION "public"."get_account_current_ownership"("p_account_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_account_disposals"("p_account_ids" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS TABLE("id" "uuid", "user_id" "uuid", "account_id" "uuid", "disposed_on" "date", "sale_amount" numeric, "sale_currency_code" "text", "ownership_percentage_sold" numeric, "notes" "text", "corrects_disposal_id" "uuid", "idempotency_key" "uuid", "proceeds_account_id" "uuid", "proceeds_transaction_id" "uuid", "created_at" timestamp with time zone, "is_effective" boolean)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select disposal.id, disposal.user_id, disposal.account_id, disposal.disposed_on,
    disposal.sale_amount, disposal.sale_currency_code, disposal.ownership_percentage_sold,
    disposal.notes, disposal.corrects_disposal_id, disposal.idempotency_key,
    disposal.proceeds_account_id,
    disposal.proceeds_transaction_id, disposal.created_at,
    not exists (
      select 1 from public.account_disposals correction
      where correction.corrects_disposal_id = disposal.id
    )
  from public.account_disposals disposal
  join public.financial_accounts account on account.id = disposal.account_id
  where disposal.user_id = (select auth.uid())
    and account.user_id = (select auth.uid())
    and (p_account_ids is null or disposal.account_id = any(p_account_ids))
  order by disposal.account_id, disposal.disposed_on desc, disposal.created_at desc;
$$;


ALTER FUNCTION "public"."get_account_disposals"("p_account_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_account_lifecycle_eligibility"("p_account_ids" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS TABLE("account_id" "uuid", "can_close" boolean, "close_block_reason" "text", "can_delete" boolean, "delete_block_reason" "text", "has_financial_history" boolean)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select a.id, s.can_close, s.close_block_reason, s.can_delete,
    s.delete_block_reason, s.has_financial_history
  from public.financial_accounts a
  cross join lateral public.get_account_lifecycle_state(a.id) s
  where a.user_id = auth.uid()
    and (p_account_ids is null or a.id = any(p_account_ids));
$$;


ALTER FUNCTION "public"."get_account_lifecycle_eligibility"("p_account_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_account_lifecycle_state"("p_account_id" "uuid") RETURNS TABLE("can_close" boolean, "close_block_reason" "text", "can_delete" boolean, "delete_block_reason" "text", "has_financial_history" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
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
$_$;


ALTER FUNCTION "public"."get_account_lifecycle_state"("p_account_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_account_lifecycle_state"("p_account_id" "uuid") IS 'Private lifecycle helper. Parses the text balance read model as an explicit finite decimal and fails closed when unavailable.';



CREATE OR REPLACE FUNCTION "public"."get_account_record_history"("p_account_id" "uuid", "p_cursor_occurred_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_cursor_id" "uuid" DEFAULT NULL::"uuid", "p_page_size" integer DEFAULT 50, "p_time_zone" "text" DEFAULT 'UTC'::"text") RETURNS TABLE("id" "uuid", "occurred_at" timestamp with time zone, "transaction_type_code" "text", "description" "text", "notes" "text", "main_category_id" "uuid", "subcategory_id" "uuid", "account_id" "uuid", "entry_side" "text", "account_amount" "text", "currency_code" "text", "local_date" "date", "daily_net" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_page_size integer := least(greatest(coalesce(p_page_size, 50), 1), 100);
  v_time_zone text := coalesce(nullif(btrim(p_time_zone), ''), 'UTC');
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if (p_cursor_occurred_at is null) <> (p_cursor_id is null) then
    raise exception 'history cursor must include both occurred_at and id' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = v_time_zone
  ) then
    raise exception 'history time zone is invalid' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.financial_accounts a
    where a.id = p_account_id
      and a.user_id = v_user_id
      and a.account_type_code in ('cash', 'bank')
  ) then
    raise exception 'account is not available' using errcode = '42501';
  end if;

  return query
  with effective_records as not materialized (
    select
      t.id,
      t.occurred_at,
      t.transaction_type_code,
      t.description,
      t.notes,
      t.main_category_id,
      t.subcategory_id,
      e.account_id,
      e.entry_side,
      e.account_amount,
      a.currency_code,
      (t.occurred_at at time zone v_time_zone)::date as local_date,
      case when e.entry_side = 'credit' then -e.account_amount else e.account_amount end as signed_amount
    from public.transaction_entries e
    join public.financial_transactions t
      on t.id = e.transaction_id
     and t.user_id = v_user_id
     and t.status = 'posted'
    join public.financial_accounts a
      on a.id = e.account_id
     and a.user_id = v_user_id
    where e.account_id = p_account_id
      and e.user_id = v_user_id
      and e.asset_id is null
      and t.reverses_transaction_id is null
      and not exists (
        select 1
        from public.financial_transactions reversal
        where reversal.user_id = v_user_id
          and reversal.reverses_transaction_id = t.id
      )
      and not exists (
        select 1
        from public.financial_transactions replacement
        where replacement.user_id = v_user_id
          and replacement.corrects_transaction_id = t.id
      )
  ), page_records as materialized (
    select r.*
    from effective_records r
    where p_cursor_occurred_at is null
      or (r.occurred_at, r.id) < (p_cursor_occurred_at, p_cursor_id)
    order by r.occurred_at desc, r.id desc
    limit v_page_size
  ), page_dates as materialized (
    select distinct p.local_date
    from page_records p
  ), page_date_ranges as materialized (
    select
      d.local_date,
      d.local_date::timestamp at time zone v_time_zone as occurred_at_start,
      (d.local_date + 1)::timestamp at time zone v_time_zone as occurred_at_end
    from page_dates d
  ), daily_totals as (
    select
      d.local_date,
      sum(r.signed_amount) as daily_net
    from page_date_ranges d
    join effective_records r
      on r.occurred_at >= d.occurred_at_start
     and r.occurred_at < d.occurred_at_end
    group by d.local_date
  )
  select
    r.id,
    r.occurred_at,
    r.transaction_type_code,
    r.description,
    r.notes,
    r.main_category_id,
    r.subcategory_id,
    r.account_id,
    r.entry_side,
    r.account_amount::text,
    r.currency_code,
    r.local_date,
    d.daily_net::text
  from page_records r
  join daily_totals d
    on d.local_date = r.local_date
  order by r.occurred_at desc, r.id desc
  limit v_page_size;
end;
$$;


ALTER FUNCTION "public"."get_account_record_history"("p_account_id" "uuid", "p_cursor_occurred_at" timestamp with time zone, "p_cursor_id" "uuid", "p_page_size" integer, "p_time_zone" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_account_record_history"("p_account_id" "uuid", "p_cursor_occurred_at" timestamp with time zone, "p_cursor_id" "uuid", "p_page_size" integer, "p_time_zone" "text") IS 'Returns visible effective Account Record history for one owned Cash/Bank account using an occurred_at/id keyset cursor, including complete native-currency totals for each supplied local calendar date.';



CREATE OR REPLACE FUNCTION "public"."get_account_record_history"("p_account_id" "uuid", "p_cursor_occurred_at" timestamp with time zone, "p_cursor_id" "uuid", "p_page_size" integer, "p_time_zone" "text", "p_search" "text" DEFAULT NULL::"text", "p_from_date" "date" DEFAULT NULL::"date", "p_to_date" "date" DEFAULT NULL::"date", "p_record_type" "text" DEFAULT NULL::"text", "p_main_category_id" "uuid" DEFAULT NULL::"uuid", "p_subcategory_id" "uuid" DEFAULT NULL::"uuid", "p_min_amount" numeric DEFAULT NULL::numeric, "p_max_amount" numeric DEFAULT NULL::numeric) RETURNS TABLE("id" "uuid", "occurred_at" timestamp with time zone, "transaction_type_code" "text", "description" "text", "notes" "text", "main_category_id" "uuid", "subcategory_id" "uuid", "account_id" "uuid", "entry_side" "text", "account_amount" "text", "currency_code" "text", "local_date" "date", "daily_net" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_page_size integer := least(greatest(coalesce(p_page_size, 50), 1), 100);
  v_time_zone text := coalesce(nullif(btrim(p_time_zone), ''), 'UTC');
  v_search text := nullif(btrim(p_search), '');
  v_from_occurred_at timestamptz;
  v_to_occurred_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if (p_cursor_occurred_at is null) <> (p_cursor_id is null) then
    raise exception 'history cursor must include both occurred_at and id' using errcode = '22023';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_timezone_names where name = v_time_zone
  ) then
    raise exception 'history time zone is invalid' using errcode = '22023';
  end if;
  if p_record_type is not null and p_record_type not in ('income', 'expense', 'transfer', 'refund') then
    raise exception 'history record type is invalid' using errcode = '22023';
  end if;
  if p_from_date is not null and p_to_date is not null and p_from_date > p_to_date then
    raise exception 'history start date must not be after end date' using errcode = '22023';
  end if;
  if p_min_amount is not null and p_min_amount < 0
    or p_max_amount is not null and p_max_amount < 0
    or p_min_amount is not null and p_max_amount is not null and p_min_amount > p_max_amount then
    raise exception 'history amount range is invalid' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.financial_accounts a
    where a.id = p_account_id
      and a.user_id = v_user_id
      and a.account_type_code in ('cash', 'bank')
  ) then
    raise exception 'account is not available' using errcode = '42501';
  end if;

  -- Local date filters are inclusive. Convert boundaries once so the base and
  -- Daily Net queries retain range predicates on occurred_at (DST-safe).
  v_from_occurred_at := case when p_from_date is null then null else p_from_date::timestamp at time zone v_time_zone end;
  v_to_occurred_at := case when p_to_date is null then null else (p_to_date + 1)::timestamp at time zone v_time_zone end;

  return query
  with effective_records as not materialized (
    select
      t.id,
      t.occurred_at,
      t.transaction_type_code,
      t.description,
      t.notes,
      t.main_category_id,
      t.subcategory_id,
      e.account_id,
      e.entry_side,
      e.account_amount,
      a.currency_code,
      (t.occurred_at at time zone v_time_zone)::date as local_date,
      case when e.entry_side = 'credit' then -e.account_amount else e.account_amount end as signed_amount
    from public.transaction_entries e
    join public.financial_transactions t
      on t.id = e.transaction_id
     and t.user_id = v_user_id
     and t.status = 'posted'
    join public.financial_accounts a
      on a.id = e.account_id
     and a.user_id = v_user_id
    left join public.record_categories main_category
      on main_category.id = t.main_category_id
     and (main_category.user_id is null or main_category.user_id = v_user_id)
    left join public.record_categories subcategory
      on subcategory.id = t.subcategory_id
     and (subcategory.user_id is null or subcategory.user_id = v_user_id)
    left join public.record_category_overrides main_override
      on main_override.user_id = v_user_id and main_override.category_id = main_category.id
    left join public.record_category_overrides subcategory_override
      on subcategory_override.user_id = v_user_id and subcategory_override.category_id = subcategory.id
    where e.account_id = p_account_id
      and e.user_id = v_user_id
      and e.asset_id is null
      and (v_from_occurred_at is null or t.occurred_at >= v_from_occurred_at)
      and (v_to_occurred_at is null or t.occurred_at < v_to_occurred_at)
      and (p_record_type is null or t.transaction_type_code = p_record_type)
      and (p_main_category_id is null or t.main_category_id = p_main_category_id)
      and (p_subcategory_id is null or t.subcategory_id = p_subcategory_id)
      and (p_min_amount is null or abs(e.account_amount) >= p_min_amount)
      and (p_max_amount is null or abs(e.account_amount) <= p_max_amount)
      and (
        v_search is null
        or coalesce(t.notes, '') ilike '%' || v_search || '%'
        or coalesce(main_override.name, main_category.name, '') ilike '%' || v_search || '%'
        or coalesce(subcategory_override.name, subcategory.name, '') ilike '%' || v_search || '%'
        or coalesce(t.description, '') ilike '%' || v_search || '%'
      )
      and t.reverses_transaction_id is null
      and not exists (
        select 1
        from public.financial_transactions reversal
        where reversal.user_id = v_user_id
          and reversal.reverses_transaction_id = t.id
      )
      and not exists (
        select 1
        from public.financial_transactions replacement
        where replacement.user_id = v_user_id
          and replacement.corrects_transaction_id = t.id
      )
  ), page_records as materialized (
    select r.*
    from effective_records r
    where p_cursor_occurred_at is null
      or (r.occurred_at, r.id) < (p_cursor_occurred_at, p_cursor_id)
    order by r.occurred_at desc, r.id desc
    limit v_page_size
  ), page_dates as materialized (
    select distinct p.local_date from page_records p
  ), page_date_ranges as materialized (
    select
      d.local_date,
      d.local_date::timestamp at time zone v_time_zone as occurred_at_start,
      (d.local_date + 1)::timestamp at time zone v_time_zone as occurred_at_end
    from page_dates d
  ), daily_totals as (
    select d.local_date, sum(r.signed_amount) as daily_net
    from page_date_ranges d
    join effective_records r
      on r.occurred_at >= d.occurred_at_start
     and r.occurred_at < d.occurred_at_end
    group by d.local_date
  )
  select
    r.id, r.occurred_at, r.transaction_type_code, r.description, r.notes,
    r.main_category_id, r.subcategory_id, r.account_id, r.entry_side,
    r.account_amount::text, r.currency_code, r.local_date, d.daily_net::text
  from page_records r
  join daily_totals d on d.local_date = r.local_date
  order by r.occurred_at desc, r.id desc;
end;
$$;


ALTER FUNCTION "public"."get_account_record_history"("p_account_id" "uuid", "p_cursor_occurred_at" timestamp with time zone, "p_cursor_id" "uuid", "p_page_size" integer, "p_time_zone" "text", "p_search" "text", "p_from_date" "date", "p_to_date" "date", "p_record_type" "text", "p_main_category_id" "uuid", "p_subcategory_id" "uuid", "p_min_amount" numeric, "p_max_amount" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_account_record_history"("p_account_id" "uuid", "p_cursor_occurred_at" timestamp with time zone, "p_cursor_id" "uuid", "p_page_size" integer, "p_time_zone" "text", "p_search" "text", "p_from_date" "date", "p_to_date" "date", "p_record_type" "text", "p_main_category_id" "uuid", "p_subcategory_id" "uuid", "p_min_amount" numeric, "p_max_amount" numeric) IS 'Returns effective Account Record history for one owned Cash/Bank account using filtered occurred_at/id keyset pagination and complete filtered native-currency daily totals.';



CREATE OR REPLACE FUNCTION "public"."get_brokerage_available_cash"("p_account_id" "uuid", "p_required_cash" numeric DEFAULT NULL::numeric, "p_lock_account" boolean DEFAULT false) RETURNS numeric
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."get_brokerage_available_cash"("p_account_id" "uuid", "p_required_cash" numeric, "p_lock_account" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_brokerage_available_cash"("p_account_id" "uuid", "p_required_cash" numeric, "p_lock_account" boolean) IS 'Internal helper for owned active Brokerage cash validation. Returns opening balance plus posted non-asset debit/credit ledger effects; optional required cash rejects a below-zero future balance and optional locking serializes a future posting flow.';



CREATE TABLE IF NOT EXISTS "public"."market_prices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "asset_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "price" numeric(30,10) NOT NULL,
    "currency_code" "text" NOT NULL,
    "as_of" timestamp with time zone NOT NULL,
    "fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "price_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "market_prices_currency_code_check" CHECK (("currency_code" = ANY (ARRAY['USD'::"text", 'SAR'::"text", 'EGP'::"text", 'EUR'::"text", 'GBP'::"text", 'AED'::"text"]))),
    CONSTRAINT "market_prices_price_positive_check" CHECK (("price" > (0)::numeric)),
    CONSTRAINT "market_prices_price_type_check" CHECK (("price_type" = ANY (ARRAY['realtime'::"text", 'delayed'::"text", 'previous_close'::"text", 'stale'::"text", 'manual'::"text"]))),
    CONSTRAINT "market_prices_provider_not_blank_check" CHECK (("btrim"("provider") <> ''::"text"))
);


ALTER TABLE "public"."market_prices" OWNER TO "postgres";


COMMENT ON TABLE "public"."market_prices" IS 'Provider-attributed current price cache and user-owned manual fallback prices. It stores no derived valuation or performance data.';



COMMENT ON COLUMN "public"."market_prices"."user_id" IS 'Null identifies trusted shared provider cache rows. Non-null rows are user-owned manual prices protected by RLS.';



COMMENT ON COLUMN "public"."market_prices"."fetched_at" IS 'Time Tharwati successfully fetched and validated the provider price.';



COMMENT ON COLUMN "public"."market_prices"."price_type" IS 'Price provenance: realtime, delayed, previous_close, stale, or manual.';



CREATE OR REPLACE FUNCTION "public"."get_current_market_price"("p_asset_id" "uuid") RETURNS SETOF "public"."market_prices"
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select prices.*
  from public.market_prices as prices
  where prices.asset_id = p_asset_id
    and prices.price > 0
    and prices.as_of <= pg_catalog.statement_timestamp()
  order by prices.as_of desc, prices.id desc
  limit 1;
$$;


ALTER FUNCTION "public"."get_current_market_price"("p_asset_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_current_market_price"("p_asset_id" "uuid") IS 'Returns the latest RLS-visible positive price effective at database statement time.';



CREATE OR REPLACE FUNCTION "public"."get_effective_account_valuations"("p_account_ids" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS TABLE("id" "uuid", "user_id" "uuid", "account_id" "uuid", "valuation_amount" numeric, "valued_on" "date", "valuation_method" "text", "notes" "text", "corrects_valuation_id" "uuid", "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select valuation.id, valuation.user_id, valuation.account_id,
    valuation.valuation_amount, valuation.valued_on, valuation.valuation_method,
    valuation.notes, valuation.corrects_valuation_id, valuation.created_at
  from public.account_valuations valuation
  join public.financial_accounts account on account.id = valuation.account_id
  where valuation.user_id = (select auth.uid())
    and account.user_id = (select auth.uid())
    and account.account_type_code in ('real_estate', 'business')
    and (p_account_ids is null or valuation.account_id = any(p_account_ids))
    and not exists (
      select 1 from public.account_valuations correction
      where correction.corrects_valuation_id = valuation.id
    )
  order by valuation.account_id, valuation.valued_on desc, valuation.created_at desc;
$$;


ALTER FUNCTION "public"."get_effective_account_valuations"("p_account_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_effective_metal_purchases"("p_account_ids" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS SETOF "public"."metal_purchases"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select purchase.*
  from public.metal_purchases as purchase
  where purchase.user_id = auth.uid()
    and (p_account_ids is null or purchase.account_id = any (p_account_ids))
    and not exists (
      select 1
      from public.metal_purchase_lifecycle_events as event
      where event.affected_purchase_id = purchase.id
    )
  order by purchase.purchased_at desc, purchase.created_at desc, purchase.id desc;
$$;


ALTER FUNCTION "public"."get_effective_metal_purchases"("p_account_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_expense_refund_summary"("p_expense_transaction_id" "uuid") RETURNS TABLE("expense_transaction_id" "uuid", "original_amount" "text", "effective_refunded_amount" "text", "remaining_refundable_amount" "text", "currency_code" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_original_amount numeric;
  v_refunded numeric;
  v_currency_code text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select entry.account_amount, transaction.transaction_currency_code
  into v_original_amount, v_currency_code
  from public.financial_transactions transaction
  join public.transaction_entries entry
    on entry.transaction_id = transaction.id
   and entry.account_id is not null
   and entry.entry_side = 'credit'
  where transaction.id = p_expense_transaction_id
    and transaction.user_id = v_user_id
    and transaction.transaction_type_code = 'expense'
    and transaction.status = 'posted';

  if not found then
    raise exception 'posted expense is not available' using errcode = 'P0002';
  end if;

  select coalesce(sum(entry.account_amount), 0)
  into v_refunded
  from public.financial_transactions refund
  join public.transaction_entries entry
    on entry.transaction_id = refund.id
   and entry.account_id is not null
   and entry.entry_side = 'debit'
   and entry.memo = 'expense_refund_received'
  where refund.refunds_transaction_id = p_expense_transaction_id
    and refund.user_id = v_user_id
    and refund.transaction_type_code = 'refund'
    and refund.status = 'posted'
    and not exists (
      select 1
      from public.financial_transactions cancellation
      where cancellation.reverses_transaction_id = refund.id
        and cancellation.transaction_type_code = 'refund_cancellation'
        and cancellation.status = 'posted'
    );

  return query select
    p_expense_transaction_id,
    v_original_amount::text,
    v_refunded::text,
    (v_original_amount - v_refunded)::text,
    v_currency_code;
end;
$$;


ALTER FUNCTION "public"."get_expense_refund_summary"("p_expense_transaction_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_expense_refund_summary"("p_expense_transaction_id" "uuid") IS 'Returns original, effective refunded, and remaining refundable amounts for one owned Expense.';



CREATE OR REPLACE FUNCTION "public"."goal_funded_amount"("p_goal_id" "uuid") RETURNS numeric
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce(sum(case
    when e.entry_type = 'progress' then e.amount
    when e.entry_type = 'withdrawal' then -e.amount
    when original.entry_type = 'progress' then -e.amount
    when original.entry_type = 'withdrawal' then e.amount
    else 0 end), 0)::numeric
  from public.goal_progress_entries e
  left join public.goal_progress_entries original on original.id = e.reverses_entry_id
  where e.goal_id = p_goal_id;
$$;


ALTER FUNCTION "public"."goal_funded_amount"("p_goal_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  insert into public.profiles (id, full_name, onboarding_completed)
  values (new.id, new.raw_user_meta_data ->> 'full_name', false)
  on conflict (id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invalidate_dashboard_snapshot_for_asset"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_asset_id uuid;
  v_old_user_id uuid;
  v_new_user_id uuid;
  v_was_or_is_global boolean := false;
begin
  if tg_op = 'DELETE' then
    v_asset_id := old.id;
  else
    v_asset_id := new.id;
  end if;

  if tg_op <> 'INSERT' then
    v_old_user_id := old.user_id;
    v_was_or_is_global := v_was_or_is_global or v_old_user_id is null;
    if v_old_user_id is not null then
      perform public.invalidate_dashboard_valuation_snapshots(v_old_user_id);
    end if;
  end if;

  if tg_op <> 'DELETE' then
    v_new_user_id := new.user_id;
    v_was_or_is_global := v_was_or_is_global or v_new_user_id is null;
    if v_new_user_id is not null
      and v_new_user_id is distinct from v_old_user_id then
      perform public.invalidate_dashboard_valuation_snapshots(v_new_user_id);
    end if;
  end if;

  if v_was_or_is_global then
    delete from public.dashboard_valuation_snapshots as snapshots
    where exists (
      select 1
      from public.holdings
      where holdings.user_id = snapshots.user_id
        and holdings.asset_id = v_asset_id
    );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."invalidate_dashboard_snapshot_for_asset"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invalidate_dashboard_snapshot_for_financial_transaction"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_old_user_id uuid;
  v_new_user_id uuid;
  v_affects_dashboard boolean := false;
begin
  if tg_op = 'INSERT' then
    v_new_user_id := new.user_id;
    v_affects_dashboard := new.status = 'posted';
  elsif tg_op = 'UPDATE' then
    v_old_user_id := old.user_id;
    v_new_user_id := new.user_id;
    v_affects_dashboard := old.status = 'posted' or new.status = 'posted';
  else
    v_old_user_id := old.user_id;
    v_affects_dashboard := old.status = 'posted';
  end if;

  if v_affects_dashboard and v_old_user_id is not null then
    perform public.invalidate_dashboard_valuation_snapshots(v_old_user_id);
  end if;
  if v_affects_dashboard and v_new_user_id is not null
    and v_new_user_id is distinct from v_old_user_id then
    perform public.invalidate_dashboard_valuation_snapshots(v_new_user_id);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."invalidate_dashboard_snapshot_for_financial_transaction"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invalidate_dashboard_snapshot_for_row"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_old_user_id uuid;
  v_new_user_id uuid;
begin
  if tg_op <> 'INSERT' then
    v_old_user_id := old.user_id;
    if v_old_user_id is not null then
      perform public.invalidate_dashboard_valuation_snapshots(v_old_user_id);
    end if;
  end if;

  if tg_op <> 'DELETE' then
    v_new_user_id := new.user_id;
    if v_new_user_id is not null
      and v_new_user_id is distinct from v_old_user_id then
      perform public.invalidate_dashboard_valuation_snapshots(v_new_user_id);
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."invalidate_dashboard_snapshot_for_row"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invalidate_dashboard_valuation_snapshots"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  delete from public.dashboard_valuation_snapshots
  where user_id = p_user_id;
$$;


ALTER FUNCTION "public"."invalidate_dashboard_valuation_snapshots"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_account_disposal_proceeds_internal"("p_disposal_id" "uuid", "p_source_account_type" "text", "p_destination_account_id" "uuid", "p_sale_amount" numeric, "p_sale_currency_code" "text", "p_disposed_on" "date", "p_notes" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_destination public.financial_accounts%rowtype;
  v_transaction public.financial_transactions%rowtype;
  v_destination_balance numeric;
begin
  if v_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  if p_disposal_id is null or p_sale_amount is null or p_sale_amount <= 0
    or p_sale_currency_code not in ('USD', 'SAR', 'EGP', 'EUR', 'GBP', 'AED')
    or p_disposed_on is null then
    raise exception 'Valid disposal proceeds fields are required' using errcode = '23514';
  end if;

  select * into v_destination
  from public.financial_accounts
  where id = p_destination_account_id
    and user_id = v_user_id
    and is_active
    and account_type_code in ('cash', 'bank')
  for update;
  if not found then
    raise exception 'An active owned Cash or Bank destination account is required'
      using errcode = '42501';
  end if;
  if v_destination.currency_code <> p_sale_currency_code then
    raise exception 'Destination account currency must match sale currency'
      using errcode = '23514';
  end if;

  if v_destination.account_type_code = 'bank' and v_destination.bank_subtype = 'credit' then
    select v_destination.opening_balance + coalesce(sum(
      case entries.entry_side
        when 'debit' then entries.account_amount
        when 'credit' then -entries.account_amount
      end
    ) filter (where transactions.status = 'posted'), 0)
    into v_destination_balance
    from public.transaction_entries entries
    join public.financial_transactions transactions
      on transactions.id = entries.transaction_id
    where entries.account_id = v_destination.id and entries.asset_id is null;

    if v_destination.credit_card_limit is null
      or v_destination_balance + p_sale_amount > v_destination.credit_card_limit then
      raise exception 'Destination available credit would exceed its credit limit'
        using errcode = '23514';
    end if;
  end if;

  insert into public.financial_transactions (
    user_id, transaction_type_code, transaction_currency_code, status,
    occurred_at, description, external_reference, notes
  ) values (
    v_user_id,
    'account_disposal_proceeds',
    p_sale_currency_code,
    'draft',
    p_disposed_on::timestamp at time zone 'UTC',
    case p_source_account_type
      when 'real_estate' then 'Real Estate sale proceeds'
      else 'Business sale proceeds'
    end,
    'account_disposal:' || p_disposal_id::text,
    nullif(btrim(p_notes), '')
  ) returning * into v_transaction;

  insert into public.transaction_entries (
    transaction_id, user_id, account_id, entry_side,
    transaction_amount, account_amount, memo
  ) values
    (v_transaction.id, v_user_id, v_destination.id, 'debit',
      p_sale_amount, p_sale_amount, 'account_disposal_proceeds_received'),
    (v_transaction.id, v_user_id, null, 'credit',
      p_sale_amount, p_sale_amount, 'account_disposal_proceeds');

  select * into v_transaction from public.post_transaction(v_transaction.id);
  return v_transaction.id;
end;
$$;


ALTER FUNCTION "public"."post_account_disposal_proceeds_internal"("p_disposal_id" "uuid", "p_source_account_type" "text", "p_destination_account_id" "uuid", "p_sale_amount" numeric, "p_sale_currency_code" "text", "p_disposed_on" "date", "p_notes" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."post_account_disposal_proceeds_internal"("p_disposal_id" "uuid", "p_source_account_type" "text", "p_destination_account_id" "uuid", "p_sale_amount" numeric, "p_sale_currency_code" "text", "p_disposed_on" "date", "p_notes" "text") IS 'Internal atomic poster for same-currency Real Estate and Business disposal proceeds. Uses a dedicated immutable ledger classification and never records ordinary income or owner contribution.';



CREATE OR REPLACE FUNCTION "public"."post_account_record_internal"("p_record_type" "text", "p_account_id" "uuid", "p_counterparty_account_id" "uuid", "p_amount" numeric, "p_received_amount" numeric, "p_occurred_at" timestamp with time zone, "p_category" "text", "p_notes" "text", "p_main_category_id" "uuid", "p_subcategory_id" "uuid", "p_reverses_transaction_id" "uuid" DEFAULT NULL::"uuid", "p_corrects_transaction_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
    p_reverses_transaction_id,
    p_corrects_transaction_id,
    null
  );
$$;


ALTER FUNCTION "public"."post_account_record_internal"("p_record_type" "text", "p_account_id" "uuid", "p_counterparty_account_id" "uuid", "p_amount" numeric, "p_received_amount" numeric, "p_occurred_at" timestamp with time zone, "p_category" "text", "p_notes" "text", "p_main_category_id" "uuid", "p_subcategory_id" "uuid", "p_reverses_transaction_id" "uuid", "p_corrects_transaction_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."post_account_record_internal"("p_record_type" "text", "p_account_id" "uuid", "p_counterparty_account_id" "uuid", "p_amount" numeric, "p_received_amount" numeric, "p_occurred_at" timestamp with time zone, "p_category" "text", "p_notes" "text", "p_main_category_id" "uuid", "p_subcategory_id" "uuid", "p_reverses_transaction_id" "uuid", "p_corrects_transaction_id" "uuid") IS 'Internal immutable account-record posting helper. Access is limited to security-definer account-record RPCs.';



CREATE OR REPLACE FUNCTION "public"."post_account_record_internal"("p_record_type" "text", "p_account_id" "uuid", "p_counterparty_account_id" "uuid", "p_amount" numeric, "p_received_amount" numeric, "p_occurred_at" timestamp with time zone, "p_category" "text", "p_notes" "text", "p_main_category_id" "uuid", "p_subcategory_id" "uuid", "p_reverses_transaction_id" "uuid", "p_corrects_transaction_id" "uuid", "p_transaction_amount" numeric) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_account public.financial_accounts%rowtype;
  v_counterparty public.financial_accounts%rowtype;
  v_transaction public.financial_transactions%rowtype;
  v_account_balance numeric;
  v_counterparty_balance numeric;
  v_received numeric;
  v_transaction_amount numeric;
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
    v_transaction_amount := coalesce(p_transaction_amount, p_amount);
    if v_transaction_amount <= 0 then
      raise exception 'transaction amount must be positive' using errcode = '22023';
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
      v_transaction.id, v_user_id, v_counterparty.id, 'debit', v_transaction_amount, v_received, 'transfer_received'
    ), (
      v_transaction.id, v_user_id, v_account.id, 'credit', v_transaction_amount, p_amount, 'transfer_sent'
    );
  end if;

  select * into v_transaction from public.post_transaction(v_transaction.id);
  return jsonb_build_object('transaction', to_jsonb(v_transaction));
end;
$$;


ALTER FUNCTION "public"."post_account_record_internal"("p_record_type" "text", "p_account_id" "uuid", "p_counterparty_account_id" "uuid", "p_amount" numeric, "p_received_amount" numeric, "p_occurred_at" timestamp with time zone, "p_category" "text", "p_notes" "text", "p_main_category_id" "uuid", "p_subcategory_id" "uuid", "p_reverses_transaction_id" "uuid", "p_corrects_transaction_id" "uuid", "p_transaction_amount" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_brokerage_buy_internal"("p_account_id" "uuid", "p_asset_id" "uuid", "p_quantity" numeric, "p_unit_price" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_fees" numeric, "p_account_fx_rate" numeric) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_account public.financial_accounts%rowtype;
  v_asset public.assets%rowtype;
  v_transaction public.financial_transactions%rowtype;
  v_holding public.holdings%rowtype;
  v_purchase_amount numeric;
  v_fees numeric;
  v_transaction_total numeric;
  v_purchase_account_amount numeric;
  v_fees_account_amount numeric;
  v_required_cash numeric;
  v_occurred_at timestamptz := coalesce(p_occurred_at, now());
  v_entries jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_account_id is null or p_asset_id is null
    or p_quantity is null or p_quantity <= 0
    or p_unit_price is null or p_unit_price <= 0 then
    raise exception 'Brokerage account, asset, quantity, and unit purchase price are required'
      using errcode = '22023';
  end if;
  if coalesce(p_fees, 0::numeric) < 0 then
    raise exception 'Buy fees cannot be negative' using errcode = '22023';
  end if;

  select * into v_account
  from public.financial_accounts as accounts
  where accounts.id = p_account_id
    and accounts.user_id = v_user_id
    and accounts.is_active
    and accounts.account_type_code = 'brokerage'
  for update;
  if not found then
    raise exception 'selected active Brokerage account is not available' using errcode = 'P0002';
  end if;

  select * into v_asset
  from public.assets as assets
  where assets.id = p_asset_id
    and assets.is_active
    and (assets.user_id is null or assets.user_id = v_user_id)
  for share;
  if not found then
    raise exception 'selected visible asset is not available' using errcode = 'P0002';
  end if;

  -- Monetary ledger columns are numeric(30,10). Normalize each component
  -- before converting, balancing, validating cash, or inserting entries.
  v_purchase_amount := pg_catalog.round(p_quantity * p_unit_price, 10);
  v_fees := pg_catalog.round(coalesce(p_fees, 0::numeric), 10);
  v_transaction_total := v_purchase_amount + v_fees;
  if v_transaction_total <= 0 then
    raise exception 'normalized Buy total must be positive' using errcode = '22023';
  end if;
  if v_asset.currency_code = v_account.currency_code then
    if p_account_fx_rate is not null then
      raise exception 'account FX rate is not accepted when asset and Brokerage currencies match'
        using errcode = '22023';
    end if;
    v_purchase_account_amount := pg_catalog.round(v_purchase_amount, 10);
    v_fees_account_amount := pg_catalog.round(v_fees, 10);
  else
    if p_account_fx_rate is null or p_account_fx_rate <= 0 then
      raise exception 'cross-currency Brokerage buys require a positive historical account FX rate'
        using errcode = '22023';
    end if;
    v_purchase_account_amount := pg_catalog.round(
      v_purchase_amount * p_account_fx_rate,
      10
    );
    v_fees_account_amount := pg_catalog.round(
      v_fees * p_account_fx_rate,
      10
    );
  end if;
  v_required_cash := v_purchase_account_amount + v_fees_account_amount;

  -- This validates the owned active Brokerage account again while retaining its
  -- row lock, and rejects the complete posting before a draft is created.
  perform public.get_brokerage_available_cash(p_account_id, v_required_cash, true);

  insert into public.financial_transactions (
    user_id, transaction_type_code, transaction_currency_code, status,
    occurred_at, description, notes
  ) values (
    v_user_id, 'buy', v_asset.currency_code, 'draft', v_occurred_at,
    'Buy: ' || v_asset.name, nullif(pg_catalog.btrim(p_notes), '')
  ) returning * into v_transaction;

  insert into public.transaction_entries (
    transaction_id, user_id, account_id, asset_id, entry_side,
    transaction_amount, account_amount, quantity_delta, cost_basis_delta,
    account_fx_rate, account_fx_effective_at, account_fx_source, unit_price, memo
  ) values (
    v_transaction.id, v_user_id, v_account.id, v_asset.id, 'debit',
    v_purchase_amount, v_purchase_account_amount, p_quantity, v_purchase_amount,
    case when v_asset.currency_code = v_account.currency_code then null else p_account_fx_rate end,
    case when v_asset.currency_code = v_account.currency_code then null else v_occurred_at end,
    case when v_asset.currency_code = v_account.currency_code then null else 'buy_input' end,
    p_unit_price, 'brokerage_buy_asset'
  );

  if v_fees > 0 then
    insert into public.transaction_entries (
      transaction_id, user_id, account_id, asset_id, entry_side,
      transaction_amount, account_amount, quantity_delta, cost_basis_delta,
      account_fx_rate, account_fx_effective_at, account_fx_source, unit_price, memo
    ) values (
      v_transaction.id, v_user_id, v_account.id, v_asset.id, 'debit',
      v_fees, v_fees_account_amount, 0::numeric, v_fees,
      case when v_asset.currency_code = v_account.currency_code then null else p_account_fx_rate end,
      case when v_asset.currency_code = v_account.currency_code then null else v_occurred_at end,
      case when v_asset.currency_code = v_account.currency_code then null else 'buy_input' end,
      null, 'brokerage_buy_fee'
    );
  end if;

  insert into public.transaction_entries (
    transaction_id, user_id, account_id, asset_id, entry_side,
    transaction_amount, account_amount, memo
  ) values (
    v_transaction.id, v_user_id, v_account.id, null, 'credit',
    v_transaction_total, v_required_cash, 'brokerage_buy_cash'
  );

  select * into v_transaction from public.post_transaction(v_transaction.id);
  select * into v_holding
  from public.holdings as holdings
  where holdings.user_id = v_user_id
    and holdings.account_id = v_account.id
    and holdings.asset_id = v_asset.id;
  select coalesce(
    pg_catalog.jsonb_agg(pg_catalog.to_jsonb(entries) order by entries.created_at, entries.id),
    '[]'::jsonb
  ) into v_entries
  from public.transaction_entries as entries
  where entries.transaction_id = v_transaction.id;

  return pg_catalog.jsonb_build_object(
    'account', pg_catalog.to_jsonb(v_account),
    'asset', pg_catalog.to_jsonb(v_asset),
    'transaction', pg_catalog.to_jsonb(v_transaction),
    'entries', v_entries,
    'holding', pg_catalog.to_jsonb(v_holding),
    'required_cash', v_required_cash::text
  );
end;
$$;


ALTER FUNCTION "public"."post_brokerage_buy_internal"("p_account_id" "uuid", "p_asset_id" "uuid", "p_quantity" numeric, "p_unit_price" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_fees" numeric, "p_account_fx_rate" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_brokerage_cash_transfer_internal"("p_source_account_id" "uuid", "p_destination_account_id" "uuid", "p_amount" numeric, "p_received_amount" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_reverses_transaction_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_source public.financial_accounts%rowtype;
  v_destination public.financial_accounts%rowtype;
  v_locked public.financial_accounts%rowtype;
  v_source_balance numeric;
  v_destination_balance numeric;
  v_received numeric;
  v_transaction public.financial_transactions%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_source_account_id is null or p_destination_account_id is null
    or p_source_account_id = p_destination_account_id then
    raise exception 'source and destination accounts must be different' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 or p_occurred_at is null then
    raise exception 'transfer amount and date are required' using errcode = '22023';
  end if;

  -- Lock both accounts in UUID order before any balance validation.
  for v_locked in
    select *
    from public.financial_accounts
    where id in (p_source_account_id, p_destination_account_id)
      and user_id = v_user_id
      and is_active
    order by id
    for update
  loop
    if v_locked.id = p_source_account_id then v_source := v_locked; end if;
    if v_locked.id = p_destination_account_id then v_destination := v_locked; end if;
  end loop;

  if v_source.id is null or v_destination.id is null then
    raise exception 'selected active accounts are not available' using errcode = '42501';
  end if;
  if not (
    (v_source.account_type_code in ('cash', 'bank') and v_destination.account_type_code = 'brokerage')
    or (v_source.account_type_code = 'brokerage' and v_destination.account_type_code in ('cash', 'bank'))
  ) then
    raise exception 'transfer must be between Cash or Bank and Brokerage' using errcode = '22023';
  end if;

  v_received := case
    when v_source.currency_code = v_destination.currency_code then p_amount
    else p_received_amount
  end;
  if v_received is null or v_received <= 0 then
    raise exception 'received amount must be positive' using errcode = '22023';
  end if;

  if v_source.account_type_code = 'brokerage' then
    perform public.get_brokerage_available_cash(v_source.id, p_amount, true);
  else
    select accounts.opening_balance + coalesce(sum(
      case entries.entry_side when 'debit' then entries.account_amount when 'credit' then -entries.account_amount end
    ) filter (where transactions.status = 'posted'), 0::numeric)
    into v_source_balance
    from public.financial_accounts as accounts
    left join public.transaction_entries as entries
      on entries.account_id = accounts.id and entries.asset_id is null
    left join public.financial_transactions as transactions
      on transactions.id = entries.transaction_id and transactions.user_id = accounts.user_id
    where accounts.id = v_source.id
    group by accounts.opening_balance;

    if v_source_balance < p_amount then
      raise exception 'insufficient available balance' using errcode = 'P0002';
    end if;
  end if;

  if v_destination.account_type_code = 'bank' and v_destination.bank_subtype = 'credit' then
    select accounts.opening_balance + coalesce(sum(
      case entries.entry_side when 'debit' then entries.account_amount when 'credit' then -entries.account_amount end
    ) filter (where transactions.status = 'posted'), 0::numeric)
    into v_destination_balance
    from public.financial_accounts as accounts
    left join public.transaction_entries as entries
      on entries.account_id = accounts.id and entries.asset_id is null
    left join public.financial_transactions as transactions
      on transactions.id = entries.transaction_id and transactions.user_id = accounts.user_id
    where accounts.id = v_destination.id
    group by accounts.opening_balance;

    if v_destination.credit_card_limit is null
      or v_destination_balance + v_received > v_destination.credit_card_limit then
      raise exception 'destination credit account limit would be exceeded' using errcode = '23514';
    end if;
  end if;

  insert into public.financial_transactions (
    user_id, transaction_type_code, transaction_currency_code, status,
    occurred_at, description, notes, reverses_transaction_id
  ) values (
    v_user_id, 'transfer', v_source.currency_code, 'draft', p_occurred_at,
    'Brokerage cash transfer', nullif(btrim(p_notes), ''), p_reverses_transaction_id
  ) returning * into v_transaction;

  insert into public.transaction_entries (
    transaction_id, user_id, account_id, entry_side, transaction_amount, account_amount, memo
  ) values (
    v_transaction.id, v_user_id, v_destination.id, 'debit', p_amount, v_received,
    'brokerage_cash_transfer_received'
  ), (
    v_transaction.id, v_user_id, v_source.id, 'credit', p_amount, p_amount,
    'brokerage_cash_transfer_sent'
  );

  select * into v_transaction from public.post_transaction(v_transaction.id);
  return jsonb_build_object('transaction', to_jsonb(v_transaction));
end;
$$;


ALTER FUNCTION "public"."post_brokerage_cash_transfer_internal"("p_source_account_id" "uuid", "p_destination_account_id" "uuid", "p_amount" numeric, "p_received_amount" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_reverses_transaction_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_brokerage_sell_internal"("p_account_id" "uuid", "p_asset_id" "uuid", "p_quantity" numeric, "p_unit_sale_price" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_fees" numeric, "p_account_fx_rate" numeric) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_account public.financial_accounts%rowtype;
  v_asset public.assets%rowtype;
  v_transaction public.financial_transactions%rowtype;
  v_holding public.holdings%rowtype;
  v_current_quantity numeric;
  v_current_asset_basis numeric;
  v_current_account_basis numeric;
  v_asset_basis_reduction numeric;
  v_account_basis_reduction numeric;
  v_cost_basis_fx_rate numeric;
  v_remaining_quantity numeric;
  v_remaining_account_basis numeric;
  v_gross_proceeds numeric;
  v_fees numeric;
  v_net_proceeds numeric;
  v_gross_account_proceeds numeric;
  v_fees_account_amount numeric;
  v_net_account_proceeds numeric;
  v_occurred_at timestamptz := coalesce(p_occurred_at, now());
  v_entries jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_account_id is null or p_asset_id is null
    or p_quantity is null or p_quantity <= 0
    or p_unit_sale_price is null or p_unit_sale_price <= 0 then
    raise exception 'Brokerage account, asset, quantity, and unit sale price are required'
      using errcode = '22023';
  end if;
  if coalesce(p_fees, 0::numeric) < 0 then
    raise exception 'Sell fees cannot be negative' using errcode = '22023';
  end if;

  select * into v_account from public.financial_accounts as accounts
  where accounts.id = p_account_id and accounts.user_id = v_user_id
    and accounts.is_active and accounts.account_type_code = 'brokerage'
  for update;
  if not found then
    raise exception 'selected active Brokerage account is not available' using errcode = 'P0002';
  end if;

  select * into v_asset from public.assets as assets
  where assets.id = p_asset_id and assets.is_active
    and (assets.user_id is null or assets.user_id = v_user_id)
  for share;
  if not found then
    raise exception 'selected visible asset is not available' using errcode = 'P0002';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_account.id::text || ':' || v_asset.id::text, 0)
  );
  perform 1 from public.holdings as holdings
  where holdings.user_id = v_user_id and holdings.account_id = v_account.id
    and holdings.asset_id = v_asset.id
  for update;

  select coalesce(sum(entries.quantity_delta), 0::numeric),
    coalesce(sum(entries.cost_basis_delta), 0::numeric),
    coalesce(sum(entries.account_cost_basis_delta), 0::numeric)
  into v_current_quantity, v_current_asset_basis, v_current_account_basis
  from public.transaction_entries as entries
  join public.financial_transactions as transactions on transactions.id = entries.transaction_id
  where entries.user_id = v_user_id and entries.account_id = v_account.id
    and entries.asset_id = v_asset.id and transactions.status = 'posted';
  if v_current_quantity <= 0 or p_quantity > v_current_quantity then
    raise exception 'sell quantity exceeds the current holding quantity' using errcode = '23514';
  end if;
  if v_current_asset_basis <= 0 or v_current_account_basis <= 0 then
    raise exception 'current holding does not contain a positive cost basis' using errcode = '23514';
  end if;

  if p_quantity = v_current_quantity then
    v_asset_basis_reduction := v_current_asset_basis;
    v_account_basis_reduction := v_current_account_basis;
  else
    v_asset_basis_reduction := pg_catalog.round(v_current_asset_basis * p_quantity / v_current_quantity, 10);
    v_account_basis_reduction := pg_catalog.round(v_current_account_basis * p_quantity / v_current_quantity, 10);
  end if;
  if v_asset_basis_reduction <= 0 or v_account_basis_reduction <= 0 then
    raise exception 'sell quantity produces an invalid cost basis reduction' using errcode = '23514';
  end if;
  v_remaining_quantity := v_current_quantity - p_quantity;
  v_remaining_account_basis := v_current_account_basis - v_account_basis_reduction;
  if v_remaining_quantity > 0 and v_remaining_account_basis <= 0 then
    raise exception 'partial sell would leave a positive holding with unusable cost basis'
      using errcode = '23514';
  end if;
  if v_remaining_quantity = 0 and v_remaining_account_basis <> 0 then
    raise exception 'full sell must remove the exact remaining account cost basis'
      using errcode = '23514';
  end if;

  v_gross_proceeds := pg_catalog.round(p_quantity * p_unit_sale_price, 10);
  v_fees := pg_catalog.round(coalesce(p_fees, 0::numeric), 10);
  v_net_proceeds := v_gross_proceeds - v_fees;
  if v_net_proceeds <= 0 then
    raise exception 'Sell fees cannot exceed or equal gross proceeds' using errcode = '22023';
  end if;
  if v_asset.currency_code = v_account.currency_code then
    if p_account_fx_rate is not null then
      raise exception 'account FX rate is not accepted when asset and Brokerage currencies match' using errcode = '22023';
    end if;
    v_gross_account_proceeds := v_gross_proceeds;
    v_fees_account_amount := v_fees;
    v_net_account_proceeds := v_net_proceeds;
    v_cost_basis_fx_rate := 1::numeric;
  else
    if p_account_fx_rate is null or p_account_fx_rate <= 0 then
      raise exception 'cross-currency Brokerage sells require a positive historical account FX rate' using errcode = '22023';
    end if;
    v_gross_account_proceeds := pg_catalog.round(v_gross_proceeds * p_account_fx_rate, 10);
    v_fees_account_amount := pg_catalog.round(v_fees * p_account_fx_rate, 10);
    v_net_account_proceeds := v_gross_account_proceeds - v_fees_account_amount;
    v_cost_basis_fx_rate := pg_catalog.round(v_account_basis_reduction / v_asset_basis_reduction, 10);
    if v_cost_basis_fx_rate <= 0 then
      raise exception 'sell cost basis cannot produce a valid historical account FX rate' using errcode = '23514';
    end if;
  end if;

  insert into public.financial_transactions (
    user_id, transaction_type_code, transaction_currency_code, status,
    occurred_at, description, notes
  ) values (
    v_user_id, 'sell', v_asset.currency_code, 'draft', v_occurred_at,
    'Sell: ' || v_asset.name, nullif(pg_catalog.btrim(p_notes), '')
  ) returning * into v_transaction;

  -- Sale proceeds use their own historical FX. The zero-amount cost entry
  -- carries the proportional historical holding basis independently.
  insert into public.transaction_entries (
    transaction_id, user_id, account_id, asset_id, entry_side,
    transaction_amount, account_amount, quantity_delta, cost_basis_delta, account_cost_basis_delta,
    account_fx_rate, account_fx_effective_at, account_fx_source, unit_price, memo
  ) values (
    v_transaction.id, v_user_id, v_account.id, v_asset.id, 'credit',
    v_gross_proceeds, v_gross_account_proceeds, -p_quantity, 0::numeric, null,
    case when v_asset.currency_code = v_account.currency_code then null else p_account_fx_rate end,
    case when v_asset.currency_code = v_account.currency_code then null else v_occurred_at end,
    case when v_asset.currency_code = v_account.currency_code then null else 'sell_input' end,
    p_unit_sale_price, 'brokerage_sell_asset'
  ), (
    v_transaction.id, v_user_id, v_account.id, v_asset.id, 'credit',
    0::numeric, 0::numeric, 0::numeric, -v_asset_basis_reduction, -v_account_basis_reduction,
    case when v_asset.currency_code = v_account.currency_code then null else v_cost_basis_fx_rate end,
    case when v_asset.currency_code = v_account.currency_code then null else v_occurred_at end,
    case when v_asset.currency_code = v_account.currency_code then null else 'sell_cost_basis' end,
    null, 'brokerage_sell_cost_basis'
  ), (
    v_transaction.id, v_user_id, v_account.id, null, 'debit',
    v_net_proceeds, v_net_account_proceeds, null, null, null,
    null, null, null, null, 'brokerage_sell_cash'
  );
  if v_fees > 0 then
    insert into public.transaction_entries (
      transaction_id, user_id, account_id, asset_id, entry_side,
      transaction_amount, account_amount, quantity_delta, cost_basis_delta, account_cost_basis_delta,
      account_fx_rate, account_fx_effective_at, account_fx_source, unit_price, memo
    ) values (
      v_transaction.id, v_user_id, v_account.id, v_asset.id, 'debit',
      v_fees, v_fees_account_amount, 0::numeric, 0::numeric, null,
      case when v_asset.currency_code = v_account.currency_code then null else p_account_fx_rate end,
      case when v_asset.currency_code = v_account.currency_code then null else v_occurred_at end,
      case when v_asset.currency_code = v_account.currency_code then null else 'sell_input' end,
      null, 'brokerage_sell_fee'
    );
  end if;

  select * into v_transaction from public.post_transaction(v_transaction.id);
  select * into v_holding from public.holdings as holdings
  where holdings.user_id = v_user_id and holdings.account_id = v_account.id
    and holdings.asset_id = v_asset.id;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(entries) order by entries.created_at, entries.id), '[]'::jsonb)
  into v_entries from public.transaction_entries as entries where entries.transaction_id = v_transaction.id;
  return pg_catalog.jsonb_build_object(
    'account', pg_catalog.to_jsonb(v_account), 'asset', pg_catalog.to_jsonb(v_asset),
    'transaction', pg_catalog.to_jsonb(v_transaction), 'entries', v_entries,
    'holding', pg_catalog.to_jsonb(v_holding), 'net_account_proceeds', v_net_account_proceeds::text
  );
end;
$$;


ALTER FUNCTION "public"."post_brokerage_sell_internal"("p_account_id" "uuid", "p_asset_id" "uuid", "p_quantity" numeric, "p_unit_sale_price" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_fees" numeric, "p_account_fx_rate" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_existing_holding_internal"("p_account_id" "uuid", "p_asset_id" "uuid", "p_quantity" numeric, "p_average_cost" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_account_fx_rate" numeric) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  return public.post_existing_holding_with_links_internal(
    p_account_id, p_asset_id, p_quantity, p_average_cost,
    p_occurred_at, p_notes, p_account_fx_rate, null
  );
end;
$$;


ALTER FUNCTION "public"."post_existing_holding_internal"("p_account_id" "uuid", "p_asset_id" "uuid", "p_quantity" numeric, "p_average_cost" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_account_fx_rate" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_existing_holding_with_links_internal"("p_account_id" "uuid", "p_asset_id" "uuid", "p_quantity" numeric, "p_average_cost" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_account_fx_rate" numeric, "p_corrects_transaction_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_account public.financial_accounts%rowtype;
  v_asset public.assets%rowtype;
  v_transaction public.financial_transactions%rowtype;
  v_holding public.holdings%rowtype;
  v_total_cost_basis numeric;
  v_account_cost_basis numeric;
  v_occurred_at timestamptz := coalesce(p_occurred_at, now());
  v_entries jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_account_id is null or p_asset_id is null
    or p_quantity is null or p_quantity <= 0
    or p_average_cost is null or p_average_cost <= 0 then
    raise exception 'account, asset, quantity, and average historical cost are required'
      using errcode = '22023';
  end if;

  select * into v_account
  from public.financial_accounts as accounts
  where accounts.id = p_account_id
    and accounts.user_id = v_user_id
    and accounts.is_active
    and accounts.account_type_code = 'brokerage'
  for update;
  if not found then
    raise exception 'selected active Brokerage account is not available' using errcode = 'P0002';
  end if;

  select * into v_asset
  from public.assets as assets
  where assets.id = p_asset_id
    and assets.is_active
    and (assets.user_id is null or assets.user_id = v_user_id)
  for share;
  if not found then
    raise exception 'selected visible asset is not available' using errcode = 'P0002';
  end if;

  v_total_cost_basis := p_quantity * p_average_cost;
  if v_asset.currency_code = v_account.currency_code then
    if p_account_fx_rate is not null then
      raise exception 'account FX rate is not accepted when asset and Brokerage currencies match'
        using errcode = '22023';
    end if;
    v_account_cost_basis := v_total_cost_basis;
  else
    if p_account_fx_rate is null or p_account_fx_rate <= 0 then
      raise exception 'cross-currency existing holdings require a positive historical account FX rate'
        using errcode = '22023';
    end if;
    v_account_cost_basis := pg_catalog.round(v_total_cost_basis * p_account_fx_rate, 10);
  end if;

  insert into public.financial_transactions (
    user_id, transaction_type_code, transaction_currency_code, status,
    occurred_at, description, notes, corrects_transaction_id
  ) values (
    v_user_id, 'opening_position', v_asset.currency_code, 'draft',
    v_occurred_at, 'Existing holding: ' || v_asset.name,
    nullif(pg_catalog.btrim(p_notes), ''), p_corrects_transaction_id
  ) returning * into v_transaction;

  insert into public.transaction_entries (
    transaction_id, user_id, account_id, asset_id, entry_side,
    transaction_amount, account_amount, quantity_delta, cost_basis_delta,
    account_fx_rate, account_fx_effective_at, account_fx_source, unit_price, memo
  ) values (
    v_transaction.id, v_user_id, v_account.id, v_asset.id, 'debit',
    v_total_cost_basis, v_account_cost_basis, p_quantity, v_total_cost_basis,
    case when v_asset.currency_code = v_account.currency_code then null else p_account_fx_rate end,
    case when v_asset.currency_code = v_account.currency_code then null else v_occurred_at end,
    case when v_asset.currency_code = v_account.currency_code then null else 'opening_position_input' end,
    p_average_cost, 'existing_holding_asset'
  ), (
    v_transaction.id, v_user_id, null, null, 'credit',
    v_total_cost_basis, v_total_cost_basis, null, null,
    null, null, null, null, 'existing_holding_opening_equity'
  );

  select * into v_transaction from public.post_transaction(v_transaction.id);
  select * into v_holding
  from public.holdings as holdings
  where holdings.user_id = v_user_id
    and holdings.account_id = v_account.id
    and holdings.asset_id = v_asset.id;
  select coalesce(
    pg_catalog.jsonb_agg(pg_catalog.to_jsonb(entries) order by entries.created_at, entries.id),
    '[]'::jsonb
  ) into v_entries
  from public.transaction_entries as entries
  where entries.transaction_id = v_transaction.id;

  return pg_catalog.jsonb_build_object(
    'account', pg_catalog.to_jsonb(v_account),
    'asset', pg_catalog.to_jsonb(v_asset),
    'transaction', pg_catalog.to_jsonb(v_transaction),
    'entries', v_entries,
    'holding', pg_catalog.to_jsonb(v_holding)
  );
end;
$$;


ALTER FUNCTION "public"."post_existing_holding_with_links_internal"("p_account_id" "uuid", "p_asset_id" "uuid", "p_quantity" numeric, "p_average_cost" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_account_fx_rate" numeric, "p_corrects_transaction_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financial_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "transaction_type_code" "text" NOT NULL,
    "transaction_currency_code" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "description" "text" NOT NULL,
    "external_reference" "text",
    "notes" "text",
    "posted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "main_category_id" "uuid",
    "subcategory_id" "uuid",
    "reverses_transaction_id" "uuid",
    "corrects_transaction_id" "uuid",
    "refunds_transaction_id" "uuid",
    "refund_idempotency_key" "uuid",
    CONSTRAINT "financial_transactions_correction_not_self_check" CHECK ((("corrects_transaction_id" IS NULL) OR ("corrects_transaction_id" <> "id"))),
    CONSTRAINT "financial_transactions_description_not_blank_check" CHECK (("btrim"("description") <> ''::"text")),
    CONSTRAINT "financial_transactions_refund_contract_check" CHECK (((("transaction_type_code" = 'refund'::"text") AND ("refunds_transaction_id" IS NOT NULL) AND ("refund_idempotency_key" IS NOT NULL) AND ("reverses_transaction_id" IS NULL) AND ("corrects_transaction_id" IS NULL)) OR (("transaction_type_code" = 'refund_cancellation'::"text") AND ("refunds_transaction_id" IS NULL) AND ("refund_idempotency_key" IS NOT NULL) AND ("reverses_transaction_id" IS NOT NULL) AND ("corrects_transaction_id" IS NULL)) OR (("transaction_type_code" <> ALL (ARRAY['refund'::"text", 'refund_cancellation'::"text"])) AND ("refunds_transaction_id" IS NULL) AND ("refund_idempotency_key" IS NULL)))),
    CONSTRAINT "financial_transactions_reversal_not_self_check" CHECK ((("reverses_transaction_id" IS NULL) OR ("reverses_transaction_id" <> "id"))),
    CONSTRAINT "financial_transactions_status_allowed_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'posted'::"text"]))),
    CONSTRAINT "financial_transactions_status_posted_at_consistency_check" CHECK (((("status" = 'draft'::"text") AND ("posted_at" IS NULL)) OR (("status" = 'posted'::"text") AND ("posted_at" IS NOT NULL))))
);


ALTER TABLE "public"."financial_transactions" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_transaction"("transaction_id" "uuid") RETURNS "public"."financial_transactions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_transaction public.financial_transactions%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_transaction
  from public.financial_transactions as transactions
  where transactions.id = post_transaction.transaction_id
    and transactions.user_id = v_user_id
    and transactions.status = 'draft'
  for update;
  if not found then
    raise exception 'owned draft transaction does not exist' using errcode = 'P0002';
  end if;

  perform public.assert_account_record_transaction_balanced(v_transaction.id);

  update public.financial_transactions as transactions
  set status = 'posted'
  where transactions.id = v_transaction.id
  returning * into v_transaction;

  if exists (
    select 1
    from public.transaction_entries as entries
    where entries.transaction_id = v_transaction.id
      and entries.asset_id is not null
  ) then
    perform public.rebuild_holding_projection(v_user_id);
  end if;

  return v_transaction;
end;
$$;


ALTER FUNCTION "public"."post_transaction"("transaction_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prepare_asset_canonical_quantity_unit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if new.canonical_quantity_unit is null or btrim(new.canonical_quantity_unit) = '' then
    new.canonical_quantity_unit := case
      when new.asset_type_code in ('stock', 'etf', 'mutual_fund', 'bond') then 'shares'
      when new.asset_type_code = 'cryptocurrency' then 'coins'
      when new.asset_type_code = 'real_estate' then 'property'
      when new.asset_type_code = 'business' then 'ownership_units'
      when new.asset_type_code = 'cash_equivalent' then 'currency_amount'
      when new.asset_type_code = 'commodity' and upper(coalesce(new.symbol, '')) in ('XAU', 'XAG') then 'troy_ounces'
      else 'units'
    end;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."prepare_asset_canonical_quantity_unit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prepare_asset_identifier"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_asset_user_id uuid;
  v_asset_is_custom boolean;
begin
  select user_id, is_custom
  into v_asset_user_id, v_asset_is_custom
  from public.assets
  where id = new.asset_id;
  if not found then
    raise exception 'asset identifier requires an existing asset' using errcode = '23503';
  end if;

  new.scheme := lower(btrim(new.scheme));
  new.namespace := btrim(new.namespace);
  new.value := btrim(new.value);
  new.normalized_value := upper(btrim(new.value));
  new.user_id := v_asset_user_id;

  if (v_asset_user_id is null and v_asset_is_custom)
    or (v_asset_user_id is not null and not v_asset_is_custom) then
    raise exception 'asset identity scope is invalid' using errcode = '23514';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."prepare_asset_identifier"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prepare_investment_entry_metadata"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_status text; v_occurred_at timestamptz; v_transaction_currency text;
  v_account_currency text; v_account_type text; v_asset_owner uuid;
  v_canonical_unit text;
begin
  if new.asset_id is null then return new; end if;
  select status, occurred_at, transaction_currency_code into v_status, v_occurred_at, v_transaction_currency
  from public.financial_transactions where id = new.transaction_id and user_id = new.user_id;
  if not found then raise exception 'asset entry does not belong to its transaction owner' using errcode = '23514'; end if;
  if v_status <> 'draft' then return new; end if;
  select currency_code, account_type_code into v_account_currency, v_account_type
  from public.financial_accounts where id = new.account_id and user_id = new.user_id;
  if not found or v_account_type <> 'brokerage' then raise exception 'asset entries require an owned Brokerage account' using errcode = '23514'; end if;
  select user_id, canonical_quantity_unit into v_asset_owner, v_canonical_unit
  from public.assets where id = new.asset_id and is_active;
  if not found or (v_asset_owner is not null and v_asset_owner <> new.user_id) then raise exception 'asset entry references an unavailable asset' using errcode = '23514'; end if;
  if new.quantity_delta is not null and new.quantity_delta <> 0 then
    new.input_quantity := coalesce(new.input_quantity, new.quantity_delta);
    new.input_quantity_unit := coalesce(new.input_quantity_unit, v_canonical_unit);
    new.quantity_conversion_factor := public.quantity_conversion_factor(new.input_quantity_unit, v_canonical_unit);
    new.quantity_delta := new.input_quantity * new.quantity_conversion_factor;
  else
    new.input_quantity := null; new.input_quantity_unit := null; new.quantity_conversion_factor := null;
  end if;
  if new.cost_basis_delta is null then raise exception 'asset entries require a signed cost basis effect' using errcode = '23514'; end if;
  if v_transaction_currency = v_account_currency then
    new.account_cost_basis_delta := new.cost_basis_delta;
    new.account_fx_rate := 1::numeric; new.account_fx_effective_at := v_occurred_at; new.account_fx_source := 'identity';
  else
    if new.account_fx_rate is null or new.account_fx_rate <= 0 or new.account_fx_effective_at is null or nullif(btrim(new.account_fx_source), '') is null then raise exception 'cross-currency asset entries require immutable historical FX metadata' using errcode = '22023'; end if;
    if new.account_amount <> pg_catalog.round(new.transaction_amount * new.account_fx_rate, 10) then raise exception 'account amount does not match the supplied historical FX rate' using errcode = '23514'; end if;
    if new.memo = 'brokerage_sell_cost_basis' then
      if new.transaction_amount <> 0 or new.account_amount <> 0 or new.quantity_delta <> 0 or new.account_cost_basis_delta is null then
        raise exception 'Sell cost basis entry must be a zero-cash explicit carrying-basis adjustment' using errcode = '23514';
      end if;
    else
      new.account_cost_basis_delta := pg_catalog.round(new.cost_basis_delta * new.account_fx_rate, 10);
    end if;
    new.account_fx_source := btrim(new.account_fx_source);
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."prepare_investment_entry_metadata"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prepare_market_price_metadata"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.fetched_at := coalesce(new.fetched_at, pg_catalog.statement_timestamp());
  new.price_type := coalesce(
    new.price_type,
    case when new.provider = 'manual' then 'manual' else 'stale' end
  );

  if new.provider = 'manual' and new.price_type <> 'manual' then
    raise exception 'Manual market prices must use manual provenance.'
      using errcode = '23514', constraint = 'market_prices_manual_price_type_check';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."prepare_market_price_metadata"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_account_disposal_proceeds_link_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if new.proceeds_account_id is distinct from old.proceeds_account_id
    or new.proceeds_transaction_id is distinct from old.proceeds_transaction_id then
    raise exception 'account disposal proceeds association is immutable'
      using errcode = '55000';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."prevent_account_disposal_proceeds_link_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_direct_account_lifecycle_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."prevent_direct_account_lifecycle_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_expense_mutation_with_effective_refunds"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_original_id uuid := coalesce(new.reverses_transaction_id, new.corrects_transaction_id);
begin
  if v_original_id is not null
    and exists (
      select 1
      from public.financial_transactions original
      where original.id = v_original_id
        and original.transaction_type_code = 'expense'
    )
    and exists (
      select 1
      from public.financial_transactions refund
      where refund.refunds_transaction_id = v_original_id
        and refund.transaction_type_code = 'refund'
        and refund.status = 'posted'
        and not exists (
          select 1
          from public.financial_transactions cancellation
          where cancellation.reverses_transaction_id = refund.id
            and cancellation.transaction_type_code = 'refund_cancellation'
            and cancellation.status = 'posted'
        )
    ) then
    raise exception 'expense with effective refunds cannot be reversed or corrected'
      using errcode = '23514';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."prevent_expense_mutation_with_effective_refunds"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_future_market_price"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if new.as_of > pg_catalog.statement_timestamp() then
    raise exception 'Market price date cannot be in the future.'
      using
        errcode = '23514',
        constraint = 'market_prices_as_of_not_future_check';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."prevent_future_market_price"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_goal_progress_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if tg_op = 'DELETE' and (
    not exists (
      select 1
      from public.goals
      where id = old.goal_id and user_id = old.user_id
    )
    or not exists (
      select 1
      from auth.users
      where id = old.user_id
    )
  ) then
    return old;
  end if;

  raise exception 'Goal progress history is immutable';
end;
$$;


ALTER FUNCTION "public"."prevent_goal_progress_mutation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_legacy_non_market_opening_balance_write"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if tg_op = 'INSERT' and new.account_type_code in ('real_estate', 'business')
    and (new.initial_ownership_percentage is null or new.initial_ownership_percentage is distinct from new.ownership_percentage) then
    raise exception using errcode = '23514', message = 'Real Estate and Business accounts require an initial ownership percentage';
  end if;
  if new.account_type_code in ('real_estate', 'business')
    and ((tg_op = 'INSERT' and new.opening_balance <> 0)
      or (tg_op = 'UPDATE' and new.opening_balance is distinct from old.opening_balance)) then
    raise exception using errcode = '23514', message = 'Real Estate and Business current values must use valuations';
  end if;
  if tg_op = 'UPDATE' and new.account_type_code in ('real_estate', 'business')
    and new.currency_code is distinct from old.currency_code
    and (exists (select 1 from public.account_valuations where account_id = old.id)
      or exists (select 1 from public.account_disposals where account_id = old.id)) then
    raise exception using errcode = '23514', message = 'This account already contains financial history. Its currency cannot be changed';
  end if;
  if tg_op = 'UPDATE' and new.account_type_code in ('real_estate', 'business')
    and (new.ownership_percentage is distinct from old.ownership_percentage
      or new.initial_ownership_percentage is distinct from old.initial_ownership_percentage)
    and (exists (select 1 from public.account_valuations where account_id = old.id)
      or exists (select 1 from public.account_disposals where account_id = old.id))
    and current_setting('tharwati.disposal_projection', true) is distinct from 'on' then
    raise exception using errcode = '23514', message = 'This account already contains financial history. Its ownership cannot be changed directly';
  end if;
  if tg_op = 'UPDATE' and new.account_type_code in ('real_estate', 'business')
    and (new.closed_on is distinct from old.closed_on or new.closed_reason is distinct from old.closed_reason)
    and current_setting('tharwati.disposal_projection', true) is distinct from 'on' then
    raise exception using errcode = '23514', message = 'Account sale status is derived from disposal history';
  end if;
  if tg_op = 'UPDATE' and old.closed_reason = 'sold' and new.is_active is distinct from old.is_active
    and current_setting('tharwati.disposal_projection', true) is distinct from 'on' then
    raise exception using errcode = '23514', message = 'A sold account can be reactivated only by correcting its disposal history';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."prevent_legacy_non_market_opening_balance_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_posted_account_record_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if old.status = 'posted'
    and not (
      tg_op = 'DELETE'
      and not exists (
        select 1 from auth.users where id = old.user_id
      )
    ) then
    raise exception 'posted transaction % is immutable', old.id
      using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."prevent_posted_account_record_changes"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."prevent_posted_account_record_changes"() IS 'Rejects posted transaction updates and direct deletes while the owning Auth user exists. DELETE is permitted only after auth.users parent deletion has begun its cascade.';



CREATE OR REPLACE FUNCTION "public"."prevent_posted_account_record_entry_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_status text;
begin
  if tg_op = 'DELETE' and not exists (
    select 1 from auth.users where id = old.user_id
  ) then
    return old;
  end if;

  select status into v_status
  from public.financial_transactions
  where id = coalesce(new.transaction_id, old.transaction_id)
  for update;

  if v_status = 'posted' then
    raise exception 'entries of posted transaction are immutable'
      using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."prevent_posted_account_record_entry_changes"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."prevent_posted_account_record_entry_changes"() IS 'Rejects mutations of posted transaction entries while the owning Auth user exists. DELETE is permitted only during auth.users cascade or after the parent transaction has already cascaded.';



CREATE OR REPLACE FUNCTION "public"."quantity_conversion_factor"("p_input_unit" "text", "p_canonical_unit" "text") RETURNS numeric
    LANGUAGE "plpgsql" IMMUTABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if p_input_unit = p_canonical_unit then return 1::numeric; end if;
  if p_input_unit = 'kilograms' and p_canonical_unit = 'grams' then return 1000::numeric; end if;
  if p_input_unit = 'grams' and p_canonical_unit = 'kilograms' then return 0.001::numeric; end if;
  if p_input_unit = 'troy_ounces' and p_canonical_unit = 'grams' then return 31.1034768::numeric; end if;
  if p_input_unit = 'grams' and p_canonical_unit = 'troy_ounces' then return 1::numeric / 31.1034768::numeric; end if;
  if p_input_unit = 'kilograms' and p_canonical_unit = 'troy_ounces' then return 1000::numeric / 31.1034768::numeric; end if;
  if p_input_unit = 'troy_ounces' and p_canonical_unit = 'kilograms' then return 31.1034768::numeric / 1000::numeric; end if;
  raise exception 'quantity unit % is not compatible with canonical unit %', p_input_unit, p_canonical_unit
    using errcode = '22023';
end;
$$;


ALTER FUNCTION "public"."quantity_conversion_factor"("p_input_unit" "text", "p_canonical_unit" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rebuild_holding_projection"("p_user_id" "uuid", "p_account_id" "uuid" DEFAULT NULL::"uuid", "p_asset_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_effect record;
begin
  if p_user_id is null then
    raise exception 'holding rebuild user is required' using errcode = '22023';
  end if;
  if (p_account_id is null) <> (p_asset_id is null) then
    raise exception 'holding rebuild account and asset scopes must be supplied together'
      using errcode = '22023';
  end if;

  for v_effect in
    select distinct entries.account_id, entries.asset_id
    from public.transaction_entries as entries
    join public.financial_transactions as transactions on transactions.id = entries.transaction_id
    where entries.user_id = p_user_id
      and entries.asset_id is not null
      and transactions.status = 'posted'
      and (p_account_id is null or (entries.account_id = p_account_id and entries.asset_id = p_asset_id))
    order by entries.account_id, entries.asset_id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_effect.account_id::text || ':' || v_effect.asset_id::text, 0)
    );
  end loop;

  for v_effect in
    select entries.account_id, entries.asset_id,
      coalesce(sum(entries.quantity_delta), 0::numeric) as quantity,
      coalesce(sum(entries.account_cost_basis_delta), 0::numeric) as total_cost_basis
    from public.transaction_entries as entries
    join public.financial_transactions as transactions on transactions.id = entries.transaction_id
    where entries.user_id = p_user_id
      and entries.asset_id is not null
      and transactions.status = 'posted'
      and (p_account_id is null or (entries.account_id = p_account_id and entries.asset_id = p_asset_id))
    group by entries.account_id, entries.asset_id
  loop
    if v_effect.quantity < 0
      or v_effect.total_cost_basis < 0
      or (v_effect.quantity = 0 and v_effect.total_cost_basis <> 0) then
      raise exception 'invalid derived holding state for account % and asset %',
        v_effect.account_id, v_effect.asset_id using errcode = '23514';
    end if;
  end loop;

  insert into public.holdings (
    user_id, account_id, asset_id, quantity, average_cost,
    total_cost_basis, cost_currency_code
  )
  select entries.user_id, entries.account_id, entries.asset_id,
    sum(entries.quantity_delta),
    case when sum(entries.quantity_delta) > 0
      then sum(entries.account_cost_basis_delta) / sum(entries.quantity_delta)
      else null end,
    sum(entries.account_cost_basis_delta),
    accounts.currency_code
  from public.transaction_entries as entries
  join public.financial_transactions as transactions on transactions.id = entries.transaction_id
  join public.financial_accounts as accounts on accounts.id = entries.account_id
  where entries.user_id = p_user_id
    and entries.asset_id is not null
    and transactions.status = 'posted'
    and (p_account_id is null or (entries.account_id = p_account_id and entries.asset_id = p_asset_id))
  group by entries.user_id, entries.account_id, entries.asset_id, accounts.currency_code
  on conflict (account_id, asset_id) do update set
    quantity = excluded.quantity,
    average_cost = excluded.average_cost,
    total_cost_basis = excluded.total_cost_basis,
    cost_currency_code = excluded.cost_currency_code;

  delete from public.holdings as holdings
  where holdings.user_id = p_user_id
    and (p_account_id is null or (holdings.account_id = p_account_id and holdings.asset_id = p_asset_id))
    and not exists (
      select 1
      from public.transaction_entries as entries
      join public.financial_transactions as transactions on transactions.id = entries.transaction_id
      where entries.user_id = p_user_id
        and entries.account_id = holdings.account_id
        and entries.asset_id = holdings.asset_id
        and transactions.status = 'posted'
    );
end;
$$;


ALTER FUNCTION "public"."rebuild_holding_projection"("p_user_id" "uuid", "p_account_id" "uuid", "p_asset_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalculate_account_disposal_projection"("p_account_id" "uuid") RETURNS numeric
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_account public.financial_accounts; v_disposal public.account_disposals; v_remaining numeric;
begin
  select * into v_account from public.financial_accounts where id = p_account_id for update;
  if not found or v_account.initial_ownership_percentage is null then
    raise exception using errcode = '23514', message = 'An initial ownership percentage is required';
  end if;
  v_remaining := v_account.initial_ownership_percentage;
  for v_disposal in
    select disposal.* from public.account_disposals disposal
    where disposal.account_id = p_account_id
      and not exists (select 1 from public.account_disposals correction where correction.corrects_disposal_id = disposal.id)
    order by disposal.disposed_on, disposal.created_at, disposal.id
  loop
    if v_disposal.ownership_percentage_sold > v_remaining then
      raise exception using errcode = '23514', message = 'A disposal cannot sell more ownership than was held on its effective date';
    end if;
    if v_account.account_type_code = 'real_estate' and v_disposal.ownership_percentage_sold <> v_remaining then
      raise exception using errcode = '23514', message = 'Real Estate supports full sale only';
    end if;
    v_remaining := v_remaining - v_disposal.ownership_percentage_sold;
  end loop;
  perform set_config('tharwati.disposal_projection', 'on', true);
  update public.financial_accounts
  set ownership_percentage = v_remaining,
      is_active = case when v_remaining = 0 then false when v_account.closed_reason = 'sold' then true else is_active end,
      closed_on = case when v_remaining = 0 then (select max(disposed_on) from public.account_disposals d where d.account_id = p_account_id and not exists (select 1 from public.account_disposals c where c.corrects_disposal_id = d.id)) else null end,
      closed_reason = case when v_remaining = 0 then 'sold' else null end
  where id = p_account_id;
  return v_remaining;
end;
$$;


ALTER FUNCTION "public"."recalculate_account_disposal_projection"("p_account_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalculate_metal_purchase_account_internal"("p_user_id" "uuid", "p_account_id" "uuid") RETURNS "public"."financial_accounts"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_account public.financial_accounts%rowtype;
  v_total_grams numeric;
  v_total_cost_basis numeric;
  v_latest_purchase public.metal_purchases%rowtype;
begin
  select * into v_account
  from public.financial_accounts
  where id = p_account_id
    and user_id = p_user_id
    and account_type_code = 'gold'
  for update;

  if not found then
    raise exception 'owned Gold/Silver account % does not exist', p_account_id
      using errcode = 'P0002';
  end if;

  select
    coalesce(sum(purchase.quantity_grams), 0::numeric),
    coalesce(sum(purchase.quantity_grams * purchase.cost_per_unit + purchase.fees), 0::numeric)
  into v_total_grams, v_total_cost_basis
  from public.metal_purchases as purchase
  where purchase.user_id = p_user_id
    and purchase.account_id = p_account_id
    and not exists (
      select 1
      from public.metal_purchase_lifecycle_events as event
      where event.affected_purchase_id = purchase.id
    );

  select * into v_latest_purchase
  from public.metal_purchases as purchase
  where purchase.user_id = p_user_id
    and purchase.account_id = p_account_id
    and not exists (
      select 1
      from public.metal_purchase_lifecycle_events as event
      where event.affected_purchase_id = purchase.id
    )
  order by purchase.purchased_at desc, purchase.created_at desc, purchase.id desc
  limit 1;

  update public.financial_accounts
  set
    balance_grams = v_total_grams,
    cost_per_unit = case when v_total_grams > 0 then v_total_cost_basis / v_total_grams else null end,
    purity = v_latest_purchase.purity,
    purchase_date = v_latest_purchase.purchased_at::date
  where id = v_account.id
  returning * into v_account;

  return v_account;
end;
$$;


ALTER FUNCTION "public"."recalculate_metal_purchase_account_internal"("p_user_id" "uuid", "p_account_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reopen_financial_account"("p_account_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."reopen_financial_account"("p_account_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reopen_financial_account"("p_account_id" "uuid") IS 'Reopens an owned Closed account. Active non-metal name conflicts are scoped to the same account type, including Bank subtype.';



CREATE OR REPLACE FUNCTION "public"."replace_wealth_allocation_plan"("p_targets" "jsonb", "p_tolerance_percentage" numeric) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;

  if p_tolerance_percentage is null
    or p_tolerance_percentage::text !~ '^[0-9]+([.][0-9]{1,6})?$'
    or p_tolerance_percentage < 0
    or p_tolerance_percentage > 100 then
    raise exception using errcode = '22023', message = 'Tolerance must be a decimal from 0 to 100';
  end if;

  perform public.replace_wealth_allocation_targets(p_targets);

  insert into public.wealth_allocation_target_preferences (
    user_id,
    tolerance_percentage
  )
  values (
    v_user_id,
    p_tolerance_percentage
  )
  on conflict (user_id) do update
  set tolerance_percentage = excluded.tolerance_percentage;
end;
$_$;


ALTER FUNCTION "public"."replace_wealth_allocation_plan"("p_targets" "jsonb", "p_tolerance_percentage" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."replace_wealth_allocation_targets"("p_targets" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v_user_id uuid := auth.uid();
  v_total numeric;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;

  if p_targets is null or jsonb_typeof(p_targets) <> 'object' then
    raise exception using errcode = '22023', message = 'Targets must be a JSON object';
  end if;

  if (select count(*) from jsonb_object_keys(p_targets)) <> 6
    or exists (
      select 1
      from jsonb_object_keys(p_targets) as key
      where key not in (
        'cash_and_bank',
        'brokerage',
        'gold_and_silver',
        'real_estate',
        'business',
        'other'
      )
    )
    or exists (
      select 1
      from (values
        ('cash_and_bank'),
        ('brokerage'),
        ('gold_and_silver'),
        ('real_estate'),
        ('business'),
        ('other')
      ) as required(asset_class)
      where not (p_targets ? required.asset_class)
    ) then
    raise exception using errcode = '22023', message = 'Targets must contain every supported wealth asset class';
  end if;

  if exists (
    select 1
    from jsonb_each_text(p_targets) as target(asset_class, percentage)
    where target.percentage !~ '^[0-9]+([.][0-9]{1,6})?$'
  ) then
    raise exception using errcode = '22023', message = 'Target percentages must be decimal values';
  end if;

  if exists (
    select 1
    from jsonb_each_text(p_targets) as target(asset_class, percentage)
    where target.percentage::numeric < 0
      or target.percentage::numeric > 100
  ) then
    raise exception using errcode = '22023', message = 'Target percentages must be decimals from 0 to 100';
  end if;

  select sum(target.percentage::numeric)
  into v_total
  from jsonb_each_text(p_targets) as target(asset_class, percentage);

  if v_total <> 100 then
    raise exception using errcode = '23514', message = 'Target percentages must total exactly 100';
  end if;

  delete from public.wealth_allocation_targets
  where user_id = v_user_id;

  insert into public.wealth_allocation_targets (
    user_id,
    asset_class,
    target_percentage
  )
  select
    v_user_id,
    target.asset_class,
    target.percentage::numeric
  from jsonb_each_text(p_targets) as target(asset_class, percentage);
end;
$_$;


ALTER FUNCTION "public"."replace_wealth_allocation_targets"("p_targets" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "asset_type_code" "text" NOT NULL,
    "symbol" "text",
    "name" "text" NOT NULL,
    "currency_code" "text" NOT NULL,
    "exchange" "text",
    "is_custom" boolean DEFAULT true NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "canonical_quantity_unit" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "assets_canonical_quantity_unit_allowed_check" CHECK (("canonical_quantity_unit" = ANY (ARRAY['shares'::"text", 'grams'::"text", 'kilograms'::"text", 'troy_ounces'::"text", 'coins'::"text", 'property'::"text", 'ownership_units'::"text", 'currency_amount'::"text", 'units'::"text"]))),
    CONSTRAINT "assets_currency_code_check" CHECK (("currency_code" = ANY (ARRAY['USD'::"text", 'SAR'::"text", 'EGP'::"text", 'EUR'::"text", 'GBP'::"text", 'AED'::"text"]))),
    CONSTRAINT "assets_name_not_blank_check" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "assets_scope_consistency_check" CHECK (((("user_id" IS NULL) AND (NOT "is_custom")) OR (("user_id" IS NOT NULL) AND "is_custom")))
);


ALTER TABLE "public"."assets" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_external_brokerage_asset"("p_symbol" "text", "p_name" "text", "p_mic_code" "text", "p_display_exchange" "text", "p_country" "text", "p_currency_code" "text", "p_instrument_type" "text") RETURNS "public"."assets"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v_user_id uuid := auth.uid();
  v_symbol text := upper(btrim(p_symbol));
  v_name text := pg_catalog.regexp_replace(btrim(p_name), '\s+', ' ', 'g');
  v_mic_code text := upper(btrim(p_mic_code));
  v_display_exchange text := pg_catalog.regexp_replace(
    btrim(p_display_exchange), '\s+', ' ', 'g'
  );
  v_country text := pg_catalog.regexp_replace(btrim(p_country), '\s+', ' ', 'g');
  v_currency_code text := upper(btrim(p_currency_code));
  v_instrument_type text := pg_catalog.regexp_replace(
    btrim(p_instrument_type), '\s+', ' ', 'g'
  );
  v_asset_type_code text;
  v_identifier_namespace text;
  v_identifier_asset_id uuid;
  v_asset public.assets%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  if v_symbol is null
    or v_symbol = ''
    or length(v_symbol) > 30
    or v_symbol !~ '^[A-Z0-9][A-Z0-9._:/-]*$' then
    raise exception 'external asset symbol is invalid' using errcode = '22023';
  end if;
  if v_mic_code is null or v_mic_code !~ '^[A-Z0-9]{4}$' then
    raise exception 'external asset MIC code is invalid' using errcode = '22023';
  end if;
  if v_name is null or v_name = '' or length(v_name) > 200 then
    raise exception 'external asset name is invalid' using errcode = '22023';
  end if;
  if v_display_exchange is null
    or v_display_exchange = ''
    or length(v_display_exchange) > 120 then
    raise exception 'external asset display exchange is invalid' using errcode = '22023';
  end if;
  if v_country is null or v_country = '' or length(v_country) > 120 then
    raise exception 'external asset country is invalid' using errcode = '22023';
  end if;
  if v_instrument_type is null
    or v_instrument_type = ''
    or length(v_instrument_type) > 120 then
    raise exception 'external asset instrument type is invalid' using errcode = '22023';
  end if;
  if v_currency_code is null
    or v_currency_code not in ('USD', 'SAR', 'EGP', 'EUR', 'GBP', 'AED') then
    raise exception 'external asset currency is not supported' using errcode = '22023';
  end if;

  v_asset_type_code := case lower(v_instrument_type)
    when 'common stock' then 'stock'
    when 'preferred stock' then 'stock'
    when 'depositary receipt' then 'stock'
    when 'american depositary receipt' then 'stock'
    when 'global depositary receipt' then 'stock'
    when 'etf' then 'etf'
    when 'exchange-traded fund' then 'etf'
    when 'mutual fund' then 'mutual_fund'
    when 'bond' then 'bond'
    when 'cryptocurrency' then 'cryptocurrency'
    when 'digital currency' then 'cryptocurrency'
    when 'warrant' then 'other'
    else null
  end;

  if v_asset_type_code is null then
    raise exception 'external asset instrument type is not supported'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.asset_types as asset_types
    where asset_types.code = v_asset_type_code
      and asset_types.is_active
  ) then
    raise exception 'external asset type is not available' using errcode = '23514';
  end if;

  v_identifier_namespace := 'twelve_data:' || v_mic_code;

  -- The user-scoped lock makes repeated or concurrent resolution of the same
  -- provider identity converge before either the asset or identifier is made.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_user_id::text || ':' || v_identifier_namespace || ':' || v_symbol,
      0
    )
  );

  select assets.*
  into v_asset
  from public.asset_identifiers as identifiers
  join public.assets as assets on assets.id = identifiers.asset_id
  where identifiers.scheme = 'provider'
    and identifiers.provider = 'twelve_data'
    and lower(btrim(identifiers.namespace)) = lower(v_identifier_namespace)
    and identifiers.normalized_value = v_symbol
    and (assets.user_id is null or assets.user_id = v_user_id)
  order by (assets.user_id is null) desc
  limit 1;

  if v_asset.id is not null then
    if v_asset.currency_code <> v_currency_code
      or v_asset.asset_type_code <> v_asset_type_code then
      raise exception 'existing external asset identity is incompatible'
        using errcode = '23514';
    end if;
    if not v_asset.is_active then
      if v_asset.user_id = v_user_id then
        update public.assets as assets
        set is_active = true
        where assets.id = v_asset.id
        returning assets.* into v_asset;
      else
        raise exception 'existing external asset is inactive' using errcode = '23514';
      end if;
    end if;
    return v_asset;
  end if;

  -- A matching user-owned manual asset can safely acquire the provider
  -- identity. Global catalog rows remain server-managed and are never changed
  -- from client-supplied provider fields.
  select assets.*
  into v_asset
  from public.assets as assets
  where assets.user_id = v_user_id
    and assets.is_custom
    and upper(btrim(assets.symbol)) = v_symbol
    and lower(btrim(coalesce(assets.exchange, ''))) in (
      lower(v_display_exchange), lower(v_mic_code)
    )
  order by case
    when upper(btrim(coalesce(assets.exchange, ''))) = v_mic_code then 0
    else 1
  end
  limit 1
  for update of assets;

  if v_asset.id is not null then
    if v_asset.currency_code <> v_currency_code
      or v_asset.asset_type_code <> v_asset_type_code then
      raise exception 'existing custom asset is incompatible with provider result'
        using errcode = '23514';
    end if;
    if not v_asset.is_active then
      update public.assets as assets
      set is_active = true
      where assets.id = v_asset.id
      returning assets.* into v_asset;
    end if;
  else
    insert into public.assets (
      user_id,
      asset_type_code,
      symbol,
      name,
      currency_code,
      exchange,
      is_custom,
      is_active
    )
    values (
      v_user_id,
      v_asset_type_code,
      v_symbol,
      v_name,
      v_currency_code,
      v_display_exchange,
      true,
      true
    )
    on conflict do nothing
    returning * into v_asset;

    if v_asset.id is null then
      select assets.*
      into v_asset
      from public.assets as assets
      where assets.user_id = v_user_id
        and assets.is_custom
        and upper(btrim(assets.symbol)) = v_symbol
        and lower(btrim(coalesce(assets.exchange, ''))) = lower(v_display_exchange)
      limit 1
      for update of assets;

      if v_asset.id is null
        or v_asset.currency_code <> v_currency_code
        or v_asset.asset_type_code <> v_asset_type_code then
        raise exception 'external asset identity conflicts with an incompatible asset'
          using errcode = '23505';
      end if;
    end if;
  end if;

  insert into public.asset_identifiers (
    asset_id,
    scheme,
    namespace,
    value,
    normalized_value,
    provider,
    is_primary
  )
  values (
    v_asset.id,
    'provider',
    v_identifier_namespace,
    v_symbol,
    v_symbol,
    'twelve_data',
    not exists (
      select 1
      from public.asset_identifiers as identifiers
      where identifiers.asset_id = v_asset.id
        and identifiers.is_primary
    )
  )
  on conflict do nothing;

  select identifiers.asset_id
  into v_identifier_asset_id
  from public.asset_identifiers as identifiers
  where identifiers.user_id = v_user_id
    and identifiers.scheme = 'provider'
    and identifiers.provider = 'twelve_data'
    and lower(btrim(identifiers.namespace)) = lower(v_identifier_namespace)
    and identifiers.normalized_value = v_symbol;

  if v_identifier_asset_id is distinct from v_asset.id then
    raise exception 'external asset provider identity conflicts with another asset'
      using errcode = '23505';
  end if;

  return v_asset;
end;
$_$;


ALTER FUNCTION "public"."resolve_external_brokerage_asset"("p_symbol" "text", "p_name" "text", "p_mic_code" "text", "p_display_exchange" "text", "p_country" "text", "p_currency_code" "text", "p_instrument_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_historical_exchange_rate"("p_source_currency_code" "text", "p_destination_currency_code" "text", "p_requested_at" timestamp with time zone) RETURNS TABLE("rate" numeric, "effective_at" timestamp with time zone, "source" "text", "direction" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v_user_id uuid := auth.uid();
  v_source text := pg_catalog.upper(pg_catalog.btrim(p_source_currency_code));
  v_destination text := pg_catalog.upper(pg_catalog.btrim(p_destination_currency_code));
begin
  if v_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;
  if v_source !~ '^[A-Z]{3}$'
    or v_destination !~ '^[A-Z]{3}$'
    or v_source = v_destination
    or p_requested_at is null
  then
    raise exception 'invalid historical exchange-rate request'
      using errcode = '22023';
  end if;

  return query
  select er.rate, er.effective_at, er.source, 'direct'::text
  from public.exchange_rates as er
  where er.provider = 'frankfurter'
    and er.user_id is null
    and er.base_currency_code = v_source
    and er.quote_currency_code = v_destination
    and er.effective_at <= p_requested_at
  order by er.effective_at desc, er.id desc
  limit 1;
  if found then return; end if;

  return query
  select 1::numeric / er.rate, er.effective_at, er.source, 'inverse'::text
  from public.exchange_rates as er
  where er.provider = 'frankfurter'
    and er.user_id is null
    and er.base_currency_code = v_destination
    and er.quote_currency_code = v_source
    and er.effective_at <= p_requested_at
  order by er.effective_at desc, er.id desc
  limit 1;
  if found then return; end if;

  return query
  select er.rate, er.effective_at, er.source, 'direct'::text
  from public.exchange_rates as er
  where er.user_id = v_user_id
    and er.provider is null
    and er.base_currency_code = v_source
    and er.quote_currency_code = v_destination
    and er.effective_at <= p_requested_at
  order by er.effective_at desc, er.id desc
  limit 1;
  if found then return; end if;

  return query
  select 1::numeric / er.rate, er.effective_at, er.source, 'inverse'::text
  from public.exchange_rates as er
  where er.user_id = v_user_id
    and er.provider is null
    and er.base_currency_code = v_destination
    and er.quote_currency_code = v_source
    and er.effective_at <= p_requested_at
  order by er.effective_at desc, er.id desc
  limit 1;
end;
$_$;


ALTER FUNCTION "public"."resolve_historical_exchange_rate"("p_source_currency_code" "text", "p_destination_currency_code" "text", "p_requested_at" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."resolve_historical_exchange_rate"("p_source_currency_code" "text", "p_destination_currency_code" "text", "p_requested_at" timestamp with time zone) IS 'Decimal-safe authenticated FX resolver: provider direct/inverse, then caller-owned manual direct/inverse.';



CREATE OR REPLACE FUNCTION "public"."reverse_account_record"("p_transaction_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_original public.financial_transactions%rowtype;
  v_entry_count integer;
  v_account_id uuid;
  v_account_amount numeric;
  v_category text;
  v_source_account_id uuid;
  v_source_account_amount numeric;
  v_destination_account_id uuid;
  v_destination_account_amount numeric;
  v_transfer_transaction_amount numeric;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_original
  from public.financial_transactions
  where id = p_transaction_id
    and user_id = v_user_id
    and status = 'posted'
    and transaction_type_code in ('income', 'expense', 'transfer')
  for update;
  if not found then
    raise exception 'posted account record is not available for reversal' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.financial_transactions
    where reverses_transaction_id = v_original.id
  ) then
    raise exception 'account record has already been reversed' using errcode = '23505';
  end if;

  select count(*) into v_entry_count
  from public.transaction_entries
  where transaction_id = v_original.id;

  if v_original.transaction_type_code = 'income' then
    select e.account_id, e.account_amount, e.memo
    into v_account_id, v_account_amount, v_category
    from public.transaction_entries e
    where e.transaction_id = v_original.id
      and e.account_id is not null
      and e.entry_side = 'debit';

    if v_entry_count <> 2 or not found or not exists (
      select 1
      from public.transaction_entries e
      where e.transaction_id = v_original.id
        and e.account_id is null
        and e.entry_side = 'credit'
        and e.memo = 'owner_contribution'
    ) then
      raise exception 'transaction is not a supported income record' using errcode = '22023';
    end if;

    return public.post_account_record_internal(
      'expense', v_account_id, null, v_account_amount, null, now(), v_category,
      'Reversal of ' || v_original.id, v_original.main_category_id, v_original.subcategory_id,
      v_original.id, null
    );
  end if;

  if v_original.transaction_type_code = 'expense' then
    select e.account_id, e.account_amount, e.memo
    into v_account_id, v_account_amount, v_category
    from public.transaction_entries e
    where e.transaction_id = v_original.id
      and e.account_id is not null
      and e.entry_side = 'credit';

    if v_entry_count <> 2 or not found or not exists (
      select 1
      from public.transaction_entries e
      where e.transaction_id = v_original.id
        and e.account_id is null
        and e.entry_side = 'debit'
        and e.memo = 'owner_draw'
    ) then
      raise exception 'transaction is not a supported expense record' using errcode = '22023';
    end if;

    return public.post_account_record_internal(
      'income', v_account_id, null, v_account_amount, null, now(), v_category,
      'Reversal of ' || v_original.id, v_original.main_category_id, v_original.subcategory_id,
      v_original.id, null
    );
  end if;

  select e.account_id, e.account_amount, e.transaction_amount
  into v_source_account_id, v_source_account_amount, v_transfer_transaction_amount
  from public.transaction_entries e
  where e.transaction_id = v_original.id
    and e.account_id is not null
    and e.entry_side = 'credit'
    and e.memo = 'transfer_sent';

  if not found then
    raise exception 'transaction is not a supported transfer record' using errcode = '22023';
  end if;

  select e.account_id, e.account_amount
  into v_destination_account_id, v_destination_account_amount
  from public.transaction_entries e
  where e.transaction_id = v_original.id
    and e.account_id is not null
    and e.entry_side = 'debit'
    and e.memo = 'transfer_received'
    and e.transaction_amount = v_transfer_transaction_amount;

  if v_entry_count <> 2 or not found or v_source_account_id = v_destination_account_id then
    raise exception 'transaction is not a supported transfer record' using errcode = '22023';
  end if;

  return public.post_account_record_internal(
    'transfer',
    v_destination_account_id,
    v_source_account_id,
    v_destination_account_amount,
    v_source_account_amount,
    now(),
    null,
    'Reversal of ' || v_original.id,
    null,
    null,
    v_original.id,
    null,
    v_transfer_transaction_amount
  );
end;
$$;


ALTER FUNCTION "public"."reverse_account_record"("p_transaction_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reverse_account_record"("p_transaction_id" "uuid") IS 'Atomically posts an immutable exact-opposite reversal for an owned posted Account Record.';



CREATE OR REPLACE FUNCTION "public"."reverse_brokerage_cash_transfer"("p_transaction_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_original public.financial_transactions%rowtype;
  v_source_account_id uuid;
  v_source_amount numeric;
  v_destination_account_id uuid;
  v_destination_amount numeric;
  v_transaction_amount numeric;
  v_entry_count integer;
  v_source public.financial_accounts%rowtype;
  v_destination public.financial_accounts%rowtype;
  v_locked public.financial_accounts%rowtype;
  v_source_balance numeric;
  v_destination_balance numeric;
  v_reversal public.financial_transactions%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_original
  from public.financial_transactions
  where id = p_transaction_id and user_id = v_user_id and status = 'posted'
    and transaction_type_code = 'transfer' and description = 'Brokerage cash transfer'
  for update;
  if not found then
    raise exception 'posted Brokerage cash transfer is not available for reversal' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.financial_transactions where reverses_transaction_id = v_original.id) then
    raise exception 'Brokerage cash transfer has already been reversed' using errcode = '23505';
  end if;

  select count(*) into v_entry_count from public.transaction_entries where transaction_id = v_original.id;
  select account_id, account_amount, transaction_amount
  into v_source_account_id, v_source_amount, v_transaction_amount
  from public.transaction_entries
  where transaction_id = v_original.id and entry_side = 'credit'
    and memo = 'brokerage_cash_transfer_sent';
  select account_id, account_amount
  into v_destination_account_id, v_destination_amount
  from public.transaction_entries
  where transaction_id = v_original.id and entry_side = 'debit'
    and memo = 'brokerage_cash_transfer_received'
    and transaction_amount = v_transaction_amount;

  if v_entry_count <> 2 or v_source_account_id is null or v_destination_account_id is null then
    raise exception 'transaction is not a supported Brokerage cash transfer' using errcode = '22023';
  end if;

  -- Reverse the recorded entries directly. Re-posting this as a new transfer
  -- would incorrectly make the destination-native amount the transaction amount.
  for v_locked in
    select *
    from public.financial_accounts
    where id in (v_source_account_id, v_destination_account_id)
      and user_id = v_user_id
      and is_active
    order by id
    for update
  loop
    if v_locked.id = v_source_account_id then v_source := v_locked; end if;
    if v_locked.id = v_destination_account_id then v_destination := v_locked; end if;
  end loop;

  if v_source.id is null or v_destination.id is null then
    raise exception 'linked active accounts are not available for reversal' using errcode = 'P0002';
  end if;

  -- The original destination is credited by the reversal and therefore must
  -- retain enough current cash. This calls the locked no-margin helper when it
  -- is Brokerage, including after subsequent cash consumption.
  if v_destination.account_type_code = 'brokerage' then
    perform public.get_brokerage_available_cash(v_destination.id, v_destination_amount, true);
  else
    select accounts.opening_balance + coalesce(sum(
      case entries.entry_side when 'debit' then entries.account_amount when 'credit' then -entries.account_amount end
    ) filter (where transactions.status = 'posted'), 0::numeric)
    into v_destination_balance
    from public.financial_accounts as accounts
    left join public.transaction_entries as entries
      on entries.account_id = accounts.id and entries.asset_id is null
    left join public.financial_transactions as transactions
      on transactions.id = entries.transaction_id and transactions.user_id = accounts.user_id
    where accounts.id = v_destination.id
    group by accounts.opening_balance;
    if v_destination_balance < v_destination_amount then
      raise exception 'insufficient available balance to reverse Brokerage cash transfer' using errcode = 'P0002';
    end if;
  end if;

  -- The original source is debited by the reversal. A Bank Credit account may
  -- not be restored beyond its available-credit limit after intervening activity.
  if v_source.account_type_code = 'bank' and v_source.bank_subtype = 'credit' then
    select accounts.opening_balance + coalesce(sum(
      case entries.entry_side when 'debit' then entries.account_amount when 'credit' then -entries.account_amount end
    ) filter (where transactions.status = 'posted'), 0::numeric)
    into v_source_balance
    from public.financial_accounts as accounts
    left join public.transaction_entries as entries
      on entries.account_id = accounts.id and entries.asset_id is null
    left join public.financial_transactions as transactions
      on transactions.id = entries.transaction_id and transactions.user_id = accounts.user_id
    where accounts.id = v_source.id
    group by accounts.opening_balance;
    if v_source.credit_card_limit is null
      or v_source_balance + v_source_amount > v_source.credit_card_limit then
      raise exception 'source credit account limit would be exceeded by reversal' using errcode = '23514';
    end if;
  end if;

  insert into public.financial_transactions (
    user_id, transaction_type_code, transaction_currency_code, status,
    occurred_at, description, notes, reverses_transaction_id
  ) values (
    v_user_id, 'transfer', v_original.transaction_currency_code, 'draft', now(),
    'Reversal of Brokerage cash transfer', 'Reversal of ' || v_original.id,
    v_original.id
  ) returning * into v_reversal;

  insert into public.transaction_entries (
    transaction_id, user_id, account_id, entry_side, transaction_amount, account_amount, memo
  ) values (
    v_reversal.id, v_user_id, v_source.id, 'debit', v_transaction_amount, v_source_amount,
    'brokerage_cash_transfer_received'
  ), (
    v_reversal.id, v_user_id, v_destination.id, 'credit', v_transaction_amount, v_destination_amount,
    'brokerage_cash_transfer_sent'
  );

  select * into v_reversal from public.post_transaction(v_reversal.id);
  return jsonb_build_object('transaction', to_jsonb(v_reversal));
end;
$$;


ALTER FUNCTION "public"."reverse_brokerage_cash_transfer"("p_transaction_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reverse_existing_holding"("p_transaction_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_original public.financial_transactions%rowtype;
  v_asset_entry public.transaction_entries%rowtype;
  v_opening_entry public.transaction_entries%rowtype;
  v_account public.financial_accounts%rowtype;
  v_reversal public.financial_transactions%rowtype;
  v_holding public.holdings%rowtype;
  v_entry_count integer;
  v_current_quantity numeric;
  v_current_cost_basis numeric;
  v_remaining_quantity numeric;
  v_remaining_cost_basis numeric;
  v_entries jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_original
  from public.financial_transactions as transactions
  where transactions.id = p_transaction_id
    and transactions.user_id = v_user_id
    and transactions.transaction_type_code = 'opening_position'
    and transactions.status = 'posted'
  for update;
  if not found then
    raise exception 'posted existing holding is not available for reversal' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.financial_transactions as transactions
    where transactions.reverses_transaction_id = v_original.id
  ) then
    raise exception 'existing holding has already been reversed' using errcode = '23505';
  end if;

  select count(*) into v_entry_count
  from public.transaction_entries as entries
  where entries.transaction_id = v_original.id;
  select * into strict v_asset_entry
  from public.transaction_entries as entries
  where entries.transaction_id = v_original.id
    and entries.user_id = v_user_id and entries.memo = 'existing_holding_asset';
  select * into strict v_opening_entry
  from public.transaction_entries as entries
  where entries.transaction_id = v_original.id
    and entries.user_id = v_user_id and entries.memo = 'existing_holding_opening_equity';

  if v_entry_count <> 2
    or v_asset_entry.entry_side <> 'debit'
    or v_asset_entry.account_id is null
    or v_asset_entry.asset_id is null
    or v_asset_entry.quantity_delta is null
    or v_asset_entry.cost_basis_delta is null
    or v_asset_entry.account_cost_basis_delta is null
    or v_asset_entry.account_fx_rate is null
    or v_asset_entry.account_fx_effective_at is null
    or nullif(pg_catalog.btrim(v_asset_entry.account_fx_source), '') is null
    or v_opening_entry.entry_side <> 'credit'
    or v_opening_entry.account_id is not null
    or v_opening_entry.asset_id is not null
    or v_opening_entry.transaction_amount <> v_asset_entry.transaction_amount
  then
    raise exception 'existing holding does not contain the expected immutable ledger shape'
      using errcode = '23514';
  end if;

  select * into v_account
  from public.financial_accounts as accounts
  where accounts.id = v_asset_entry.account_id
    and accounts.user_id = v_user_id
    and accounts.is_active
    and accounts.account_type_code = 'brokerage'
  for update;
  if not found then
    raise exception 'linked active Brokerage account is not available' using errcode = 'P0002';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_account.id::text || ':' || v_asset_entry.asset_id::text, 0)
  );
  perform 1
  from public.holdings as holdings
  where holdings.user_id = v_user_id
    and holdings.account_id = v_account.id
    and holdings.asset_id = v_asset_entry.asset_id
  for update;

  select
    coalesce(sum(entries.quantity_delta), 0::numeric),
    coalesce(sum(entries.account_cost_basis_delta), 0::numeric)
  into v_current_quantity, v_current_cost_basis
  from public.transaction_entries as entries
  join public.financial_transactions as transactions on transactions.id = entries.transaction_id
  where entries.user_id = v_user_id
    and entries.account_id = v_account.id
    and entries.asset_id = v_asset_entry.asset_id
    and transactions.status = 'posted';

  v_remaining_quantity := v_current_quantity - v_asset_entry.quantity_delta;
  v_remaining_cost_basis := v_current_cost_basis - v_asset_entry.account_cost_basis_delta;
  if v_remaining_quantity < 0 then
    raise exception 'existing holding reversal would make the holding quantity negative' using errcode = '23514';
  end if;
  if v_remaining_cost_basis < 0 then
    raise exception 'existing holding reversal would make the holding cost basis negative' using errcode = '23514';
  end if;
  if v_remaining_quantity = 0 and v_remaining_cost_basis <> 0 then
    raise exception 'existing holding reversal would leave zero quantity with non-zero cost basis' using errcode = '23514';
  end if;

  insert into public.financial_transactions (
    user_id, transaction_type_code, transaction_currency_code, status,
    occurred_at, description, notes, reverses_transaction_id
  ) values (
    v_user_id, 'opening_position_reversal', v_original.transaction_currency_code,
    'draft', now(), 'Reversal of existing holding',
    'Reversal of ' || v_original.id, v_original.id
  ) returning * into v_reversal;

  insert into public.transaction_entries (
    transaction_id, user_id, account_id, asset_id, entry_side,
    transaction_amount, account_amount, quantity_delta, cost_basis_delta,
    account_fx_rate, account_fx_effective_at, account_fx_source, unit_price, memo
  ) values (
    v_reversal.id, v_user_id, v_account.id, v_asset_entry.asset_id, 'credit',
    v_asset_entry.transaction_amount, v_asset_entry.account_amount,
    -v_asset_entry.quantity_delta, -v_asset_entry.cost_basis_delta,
    v_asset_entry.account_fx_rate, v_asset_entry.account_fx_effective_at,
    v_asset_entry.account_fx_source, null, 'existing_holding_asset_reversal'
  ), (
    v_reversal.id, v_user_id, null, null, 'debit',
    v_opening_entry.transaction_amount, v_opening_entry.account_amount,
    null, null, null, null, null, null, 'existing_holding_opening_equity_reversal'
  );

  select * into v_reversal from public.post_transaction(v_reversal.id);
  select * into v_holding
  from public.holdings as holdings
  where holdings.user_id = v_user_id
    and holdings.account_id = v_account.id
    and holdings.asset_id = v_asset_entry.asset_id;
  select coalesce(
    pg_catalog.jsonb_agg(pg_catalog.to_jsonb(entries) order by entries.created_at, entries.id),
    '[]'::jsonb
  ) into v_entries
  from public.transaction_entries as entries
  where entries.transaction_id = v_reversal.id;
  return pg_catalog.jsonb_build_object(
    'original_transaction', pg_catalog.to_jsonb(v_original),
    'reversal_transaction', pg_catalog.to_jsonb(v_reversal),
    'entries', v_entries,
    'holding', pg_catalog.to_jsonb(v_holding)
  );
exception
  when no_data_found or too_many_rows then
    raise exception 'existing holding does not contain the expected immutable ledger shape'
      using errcode = '23514';
end;
$$;


ALTER FUNCTION "public"."reverse_existing_holding"("p_transaction_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reverse_existing_holding"("p_transaction_id" "uuid") IS 'Posts the exact immutable asset-side reversal of an owned existing holding. It never creates a Brokerage cash movement.';



CREATE OR REPLACE FUNCTION "public"."reverse_metal_purchase"("p_purchase_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_purchase public.metal_purchases%rowtype;
  v_funding_reversal_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;
  select * into v_purchase
  from public.metal_purchases
  where id = p_purchase_id and user_id = v_user_id
  for update;
  if not found then
    raise exception 'metal purchase is not available for reversal' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.metal_purchase_lifecycle_events
    where affected_purchase_id = v_purchase.id
  ) then
    raise exception 'metal purchase has already been reversed or corrected' using errcode = '23505';
  end if;

  v_funding_reversal_id := public.reverse_metal_purchase_funding_internal(v_user_id, v_purchase);
  insert into public.metal_purchase_lifecycle_events (
    user_id, affected_purchase_id, action, funding_reversal_transaction_id
  ) values (v_user_id, v_purchase.id, 'reversal', v_funding_reversal_id);
  perform public.recalculate_metal_purchase_account_internal(v_user_id, v_purchase.account_id);

  return jsonb_build_object(
    'reversed_purchase_id', v_purchase.id,
    'funding_reversal_transaction_id', v_funding_reversal_id
  );
end;
$$;


ALTER FUNCTION "public"."reverse_metal_purchase"("p_purchase_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reverse_metal_purchase"("p_purchase_id" "uuid") IS 'Atomically records an immutable metal-purchase reversal, reverses linked funding when present, and recomputes derived metal account fields.';



CREATE OR REPLACE FUNCTION "public"."reverse_metal_purchase_funding_internal"("p_user_id" "uuid", "p_purchase" "public"."metal_purchases") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_original public.financial_transactions%rowtype;
  v_reversal public.financial_transactions%rowtype;
  v_funding_account public.financial_accounts%rowtype;
  v_cost_basis numeric;
  v_available_balance numeric;
begin
  if p_purchase.funding_mode = 'external' then
    return null;
  end if;

  if p_purchase.funding_mode <> 'cash_account'
    or p_purchase.funding_account_id is null
    or p_purchase.funding_transaction_id is null then
    raise exception 'metal purchase funding linkage is invalid' using errcode = '23514';
  end if;

  select * into v_original
  from public.financial_transactions
  where id = p_purchase.funding_transaction_id
    and user_id = p_user_id
    and status = 'posted'
    and transaction_type_code = 'investment_purchase'
  for update;
  if not found then
    raise exception 'linked investment purchase transaction is not available' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.financial_transactions
    where reverses_transaction_id = v_original.id
  ) then
    raise exception 'linked investment purchase transaction has already been reversed' using errcode = '23505';
  end if;

  select * into v_funding_account
  from public.financial_accounts
  where id = p_purchase.funding_account_id
    and user_id = p_user_id
    and account_type_code in ('cash', 'bank')
  for update;
  if not found then
    raise exception 'linked funding account is not available' using errcode = 'P0002';
  end if;

  select entry.account_amount into v_cost_basis
  from public.transaction_entries as entry
  where entry.transaction_id = v_original.id
    and entry.account_id = v_funding_account.id
    and entry.entry_side = 'credit'
    and entry.memo = 'metal_purchase_funding';
  if not found
    or v_cost_basis <> p_purchase.quantity_grams * p_purchase.cost_per_unit + p_purchase.fees
    or (select count(*) from public.transaction_entries where transaction_id = v_original.id) <> 2
    or not exists (
      select 1 from public.transaction_entries as entry
      where entry.transaction_id = v_original.id
        and entry.account_id is null
        and entry.entry_side = 'debit'
        and entry.account_amount = v_cost_basis
        and entry.memo = 'metal_purchase_funding'
    ) then
    raise exception 'linked investment purchase transaction is not a supported metal funding movement'
      using errcode = '22023';
  end if;

  select v_funding_account.opening_balance + coalesce(sum(
    case entry.entry_side when 'debit' then entry.account_amount else -entry.account_amount end
  ) filter (where transaction.status = 'posted'), 0::numeric)
  into v_available_balance
  from public.transaction_entries as entry
  join public.financial_transactions as transaction on transaction.id = entry.transaction_id
  where entry.account_id = v_funding_account.id
    and entry.asset_id is null;

  if v_funding_account.account_type_code = 'bank'
    and v_funding_account.bank_subtype = 'credit' then
    if v_funding_account.credit_card_limit is null
      or v_available_balance + v_cost_basis > v_funding_account.credit_card_limit then
      raise exception 'available credit would exceed its credit limit' using errcode = '23514';
    end if;
  end if;

  insert into public.financial_transactions (
    user_id, transaction_type_code, transaction_currency_code, status,
    occurred_at, description, notes, reverses_transaction_id
  ) values (
    p_user_id, 'investment_purchase_reversal', v_original.transaction_currency_code, 'draft',
    now(), 'Reversal of ' || v_original.description, v_original.notes, v_original.id
  ) returning * into v_reversal;

  insert into public.transaction_entries (
    transaction_id, user_id, account_id, entry_side, transaction_amount, account_amount, memo
  ) values (
    v_reversal.id, p_user_id, null, 'credit', v_cost_basis, v_cost_basis,
    'metal_purchase_funding_reversal'
  ), (
    v_reversal.id, p_user_id, v_funding_account.id, 'debit', v_cost_basis, v_cost_basis,
    'metal_purchase_funding_reversal'
  );
  perform public.post_transaction(v_reversal.id);
  return v_reversal.id;
end;
$$;


ALTER FUNCTION "public"."reverse_metal_purchase_funding_internal"("p_user_id" "uuid", "p_purchase" "public"."metal_purchases") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_account_record_transaction_posted_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if new.status = 'draft' then
    new.posted_at := null;
  elsif old.status is distinct from 'posted' then
    new.posted_at := now();
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."set_account_record_transaction_posted_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_goal_archived"("p_goal_id" "uuid", "p_archived" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  update public.goals set archived_at=case when p_archived then coalesce(archived_at,now()) else null end, updated_at=now()
  where id=p_goal_id and user_id=auth.uid();
  if not found then raise exception 'Goal not found'; end if;
end; $$;


ALTER FUNCTION "public"."set_goal_archived"("p_goal_id" "uuid", "p_archived" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_goal_status"("p_goal_id" "uuid", "p_status" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if p_status not in ('active','completed','cancelled') then raise exception 'Invalid goal status'; end if;
  update public.goals set status=p_status, updated_at=now() where id=p_goal_id and user_id=auth.uid();
  if not found then raise exception 'Goal not found'; end if;
end; $$;


ALTER FUNCTION "public"."set_goal_status"("p_goal_id" "uuid", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."store_dashboard_valuation_snapshot"("p_base_currency_code" "text", "p_snapshot" "jsonb", "p_as_of" timestamp with time zone, "p_expires_at" timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v_user_id uuid := auth.uid();
  v_existing jsonb;
  v_expires_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_base_currency_code !~ '^[A-Z]{3}$' or p_snapshot is null
    or p_as_of is null or p_expires_at is null or p_expires_at <= p_as_of then
    raise exception 'invalid dashboard valuation snapshot' using errcode = '22023';
  end if;

  select snapshot, expires_at into v_existing, v_expires_at
  from public.dashboard_valuation_snapshots
  where user_id = v_user_id and base_currency_code = p_base_currency_code
  for update;

  if found and v_expires_at > now() then
    return v_existing;
  end if;

  insert into public.dashboard_valuation_snapshots (
    user_id, base_currency_code, snapshot, as_of, expires_at
  ) values (
    v_user_id, p_base_currency_code, p_snapshot, p_as_of, p_expires_at
  )
  on conflict (user_id, base_currency_code) do update set
    snapshot = excluded.snapshot,
    as_of = excluded.as_of,
    expires_at = excluded.expires_at,
    updated_at = now();

  return p_snapshot;
end;
$_$;


ALTER FUNCTION "public"."store_dashboard_valuation_snapshot"("p_base_currency_code" "text", "p_snapshot" "jsonb", "p_as_of" timestamp with time zone, "p_expires_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_goal"("p_goal_id" "uuid", "p_name" "text", "p_goal_type" "text", "p_custom_type_name" "text", "p_target_amount" numeric, "p_currency_code" "text", "p_target_date" "date") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_user_id uuid := auth.uid(); v_current_currency text;
begin
  select currency_code into v_current_currency from public.goals where id=p_goal_id and user_id=v_user_id for update;
  if not found then raise exception 'Goal not found'; end if;
  if p_currency_code <> v_current_currency and exists(select 1 from public.goal_progress_entries where goal_id=p_goal_id) then
    raise exception 'Goal currency is locked after progress history exists';
  end if;
  update public.goals set name=btrim(p_name), goal_type=p_goal_type,
    custom_type_name=case when p_goal_type='other' then nullif(btrim(p_custom_type_name),'') else null end,
    target_amount=p_target_amount, currency_code=p_currency_code, target_date=p_target_date, updated_at=now()
  where id=p_goal_id and user_id=v_user_id;
end; $$;


ALTER FUNCTION "public"."update_goal"("p_goal_id" "uuid", "p_name" "text", "p_goal_type" "text", "p_custom_type_name" "text", "p_target_amount" numeric, "p_currency_code" "text", "p_target_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_account_record_entry_ownership"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_transaction_type text;
begin
  select transaction_type_code into v_transaction_type
  from public.financial_transactions
  where id = new.transaction_id and user_id = new.user_id;

  if not found then
    raise exception 'transaction entry does not belong to its transaction owner'
      using errcode = '23514';
  end if;

  if v_transaction_type in (
    'income', 'expense', 'transfer', 'account_disposal_proceeds',
    'refund', 'refund_cancellation'
  ) then
    if new.account_id is not null and not exists (
      select 1
      from public.financial_accounts as accounts
      where accounts.id = new.account_id
        and accounts.user_id = new.user_id
        and (
          accounts.account_type_code in ('cash', 'bank')
          or (
            v_transaction_type = 'transfer'
            and accounts.account_type_code = 'brokerage'
            and new.memo in (
              'brokerage_cash_transfer_sent',
              'brokerage_cash_transfer_received'
            )
          )
        )
    ) then
      raise exception 'transaction entry account is not supported by this record flow'
        using errcode = '23514';
    end if;

    if new.asset_id is not null or new.quantity_delta is not null
      or new.unit_price is not null or new.purity is not null then
      raise exception 'account records cannot contain asset or quantity effects'
        using errcode = '23514';
    end if;

    if v_transaction_type = 'account_disposal_proceeds' and (
      (new.account_id is null and (new.entry_side <> 'credit' or new.memo <> 'account_disposal_proceeds'))
      or (new.account_id is not null and (new.entry_side <> 'debit' or new.memo <> 'account_disposal_proceeds_received'))
    ) then
      raise exception 'invalid account disposal proceeds entry'
        using errcode = '23514';
    end if;

    if v_transaction_type = 'refund' and (
      (new.account_id is null and (new.entry_side <> 'credit' or new.memo <> 'expense_refund'))
      or (new.account_id is not null and (new.entry_side <> 'debit' or new.memo <> 'expense_refund_received'))
    ) then
      raise exception 'invalid expense refund entry' using errcode = '23514';
    end if;

    if v_transaction_type = 'refund_cancellation' and (
      (new.account_id is null and (new.entry_side <> 'debit' or new.memo <> 'expense_refund_cancellation'))
      or (new.account_id is not null and (new.entry_side <> 'credit' or new.memo <> 'expense_refund_cancellation_sent'))
    ) then
      raise exception 'invalid expense refund cancellation entry' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."validate_account_record_entry_ownership"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_investment_posting_metadata"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if new.status <> 'posted' or old.status = 'posted' then return new; end if;
  if exists (
    select 1
    from public.transaction_entries as entries
    join public.assets as assets on assets.id = entries.asset_id
    join public.financial_accounts as accounts on accounts.id = entries.account_id
    where entries.transaction_id = new.id
      and entries.asset_id is not null
      and (
        entries.cost_basis_delta is null
        or entries.account_cost_basis_delta is null
        or entries.account_fx_rate is null
        or entries.account_fx_rate <= 0
        or entries.account_fx_effective_at is null
        or nullif(btrim(entries.account_fx_source), '') is null
        or accounts.account_type_code <> 'brokerage'
        or (
          entries.quantity_delta is not null and entries.quantity_delta <> 0
          and (
            entries.input_quantity is null
            or entries.input_quantity_unit is null
            or entries.quantity_conversion_factor is null
            or entries.quantity_conversion_factor <= 0
            or entries.quantity_delta <> entries.input_quantity * entries.quantity_conversion_factor
            or entries.quantity_conversion_factor <> public.quantity_conversion_factor(
              entries.input_quantity_unit, assets.canonical_quantity_unit
            )
          )
        )
      )
  ) then
    raise exception 'transaction % has incomplete investment metadata', new.id
      using errcode = '23514';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."validate_investment_posting_metadata"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_record_category_hierarchy"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_parent public.record_categories%rowtype;
begin
  if new.level = 'main' then return new; end if;

  select * into v_parent from public.record_categories where id = new.parent_id;
  if not found or v_parent.level <> 'main' then
    raise exception 'subcategory parent must be a main category' using errcode = '23514';
  end if;
  if new.user_id is null then
    if v_parent.user_id is not null then
      raise exception 'system subcategories require a system main category' using errcode = '23514';
    end if;
  elsif v_parent.user_id is not null and v_parent.user_id <> new.user_id then
    raise exception 'custom subcategory parent must be owned by the same user' using errcode = '42501';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."validate_record_category_hierarchy"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_record_category_override"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not exists (
    select 1 from public.record_categories
    where id = new.category_id and user_id is null and system_code is not null
  ) then
    raise exception 'category overrides apply only to system categories' using errcode = '23514';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."validate_record_category_override"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."account_types" (
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."account_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."asset_identifiers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "scheme" "text" NOT NULL,
    "namespace" "text" NOT NULL,
    "value" "text" NOT NULL,
    "normalized_value" "text" NOT NULL,
    "provider" "text",
    "is_primary" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "asset_identifiers_namespace_not_blank_check" CHECK (("btrim"("namespace") <> ''::"text")),
    CONSTRAINT "asset_identifiers_normalized_value_not_blank_check" CHECK (("btrim"("normalized_value") <> ''::"text")),
    CONSTRAINT "asset_identifiers_scheme_allowed_check" CHECK (("scheme" = ANY (ARRAY['isin'::"text", 'ticker'::"text", 'crypto_native'::"text", 'crypto_contract'::"text", 'commodity'::"text", 'precious_metal'::"text", 'custom_real_estate'::"text", 'custom_business'::"text", 'provider'::"text"]))),
    CONSTRAINT "asset_identifiers_value_not_blank_check" CHECK (("btrim"("value") <> ''::"text"))
);


ALTER TABLE "public"."asset_identifiers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."asset_types" (
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "asset_types_name_not_blank_check" CHECK (("btrim"("name") <> ''::"text"))
);


ALTER TABLE "public"."asset_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."currencies" (
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "symbol" "text",
    "decimal_places" smallint DEFAULT 2 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "currencies_decimal_places_range_check" CHECK ((("decimal_places" >= 0) AND ("decimal_places" <= 6)))
);


ALTER TABLE "public"."currencies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dashboard_valuation_snapshots" (
    "user_id" "uuid" NOT NULL,
    "base_currency_code" "text" NOT NULL,
    "snapshot" "jsonb" NOT NULL,
    "as_of" timestamp with time zone NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "dashboard_valuation_snapshots_base_currency_code_check" CHECK (("base_currency_code" = ANY (ARRAY['USD'::"text", 'SAR'::"text", 'EGP'::"text", 'EUR'::"text", 'GBP'::"text", 'AED'::"text"]))),
    CONSTRAINT "dashboard_valuation_snapshots_expiry_check" CHECK (("expires_at" > "as_of"))
);


ALTER TABLE "public"."dashboard_valuation_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exchange_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "base_currency_code" "text" NOT NULL,
    "quote_currency_code" "text" NOT NULL,
    "rate" numeric(30,12) NOT NULL,
    "effective_at" timestamp with time zone NOT NULL,
    "source" "text",
    "provider" "text",
    "fetched_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "exchange_rates_distinct_pair_check" CHECK (("base_currency_code" <> "quote_currency_code")),
    CONSTRAINT "exchange_rates_owner_provenance_check" CHECK (((("user_id" IS NULL) AND ("provider" = 'frankfurter'::"text") AND ("source" = 'frankfurter'::"text") AND ("fetched_at" IS NOT NULL)) OR (("user_id" IS NOT NULL) AND ("provider" IS NULL) AND ("fetched_at" IS NULL) AND ("source" = 'manual'::"text")))),
    CONSTRAINT "exchange_rates_rate_valid_check" CHECK ((("rate" > (0)::numeric) AND ("rate" <> 'NaN'::numeric)))
);


ALTER TABLE "public"."exchange_rates" OWNER TO "postgres";


COMMENT ON TABLE "public"."exchange_rates" IS 'Shared Frankfurter cache rows and authenticated user-owned manual FX fallback rows.';



CREATE TABLE IF NOT EXISTS "public"."goal_progress_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "goal_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "entry_type" "text" NOT NULL,
    "amount" numeric(20,2) NOT NULL,
    "effective_on" "date" NOT NULL,
    "note" "text",
    "reverses_entry_id" "uuid",
    "replacement_for_entry_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "goal_progress_entries_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "goal_progress_entries_effective_on_check" CHECK (("effective_on" <= CURRENT_DATE)),
    CONSTRAINT "goal_progress_entries_entry_type_check" CHECK (("entry_type" = ANY (ARRAY['progress'::"text", 'withdrawal'::"text", 'reversal'::"text"]))),
    CONSTRAINT "goal_progress_reversal_shape_check" CHECK (((("entry_type" = 'reversal'::"text") AND ("reverses_entry_id" IS NOT NULL) AND ("replacement_for_entry_id" IS NULL)) OR (("entry_type" <> 'reversal'::"text") AND ("reverses_entry_id" IS NULL))))
);


ALTER TABLE "public"."goal_progress_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "goal_type" "text" NOT NULL,
    "custom_type_name" "text",
    "target_amount" numeric(20,2) NOT NULL,
    "currency_code" "text" NOT NULL,
    "target_date" "date",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "goals_currency_code_check" CHECK (("currency_code" = ANY (ARRAY['USD'::"text", 'SAR'::"text", 'EGP'::"text", 'EUR'::"text", 'GBP'::"text", 'AED'::"text"]))),
    CONSTRAINT "goals_custom_type_check" CHECK (((("goal_type" = 'other'::"text") AND ("custom_type_name" IS NOT NULL) AND ("btrim"("custom_type_name") <> ''::"text")) OR (("goal_type" <> 'other'::"text") AND ("custom_type_name" IS NULL)))),
    CONSTRAINT "goals_goal_type_check" CHECK (("goal_type" = ANY (ARRAY['buy_home'::"text", 'buy_car'::"text", 'travel'::"text", 'education'::"text", 'other'::"text"]))),
    CONSTRAINT "goals_name_check" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "goals_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "goals_target_amount_check" CHECK (("target_amount" > (0)::numeric))
);


ALTER TABLE "public"."goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."holdings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "quantity" numeric(30,10) DEFAULT 0 NOT NULL,
    "average_cost" numeric(30,10),
    "total_cost_basis" numeric(30,10) DEFAULT 0 NOT NULL,
    "cost_currency_code" "text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "holdings_average_cost_non_negative_check" CHECK ((("average_cost" IS NULL) OR ("average_cost" >= (0)::numeric))),
    CONSTRAINT "holdings_quantity_non_negative_check" CHECK (("quantity" >= (0)::numeric)),
    CONSTRAINT "holdings_total_cost_basis_non_negative_check" CHECK (("total_cost_basis" >= (0)::numeric))
);


ALTER TABLE "public"."holdings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."metal_purchase_lifecycle_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "affected_purchase_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "replacement_purchase_id" "uuid",
    "funding_reversal_transaction_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "metal_purchase_lifecycle_events_action_check" CHECK (("action" = ANY (ARRAY['reversal'::"text", 'correction'::"text"]))),
    CONSTRAINT "metal_purchase_lifecycle_events_replacement_check" CHECK (((("action" = 'correction'::"text") AND ("replacement_purchase_id" IS NOT NULL)) OR (("action" = 'reversal'::"text") AND ("replacement_purchase_id" IS NULL)))),
    CONSTRAINT "metal_purchase_lifecycle_events_replacement_not_self_check" CHECK ((("replacement_purchase_id" IS NULL) OR ("replacement_purchase_id" <> "affected_purchase_id")))
);


ALTER TABLE "public"."metal_purchase_lifecycle_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."metal_purchase_lifecycle_events" IS 'Append-only audit events that make an original metal purchase ineffective after immutable reversal or correction.';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "onboarding_completed" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "country_code" "text",
    "base_currency_code" "text",
    "selected_goals" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    CONSTRAINT "profiles_base_currency_code_check" CHECK ((("base_currency_code" IS NULL) OR ("base_currency_code" = ANY (ARRAY['USD'::"text", 'SAR'::"text", 'EGP'::"text", 'EUR'::"text", 'GBP'::"text", 'AED'::"text"]))))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."country_code" IS 'ISO 3166-1 alpha-2 country code selected during onboarding.';



COMMENT ON COLUMN "public"."profiles"."base_currency_code" IS 'Currency used to display total wealth and reports, selected during onboarding.';



COMMENT ON COLUMN "public"."profiles"."selected_goals" IS 'Financial goal ids selected during onboarding (e.g. buy_home, travel).';



CREATE TABLE IF NOT EXISTS "public"."record_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "parent_id" "uuid",
    "system_code" "text",
    "level" "text" NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer NOT NULL,
    "is_archived" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "record_categories_level_check" CHECK (("level" = ANY (ARRAY['main'::"text", 'subcategory'::"text"]))),
    CONSTRAINT "record_categories_name_not_blank_check" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "record_categories_parent_level_check" CHECK (((("level" = 'main'::"text") AND ("parent_id" IS NULL)) OR (("level" = 'subcategory'::"text") AND ("parent_id" IS NOT NULL)))),
    CONSTRAINT "record_categories_sort_order_positive_check" CHECK (("sort_order" > 0)),
    CONSTRAINT "record_categories_system_ownership_check" CHECK (((("user_id" IS NULL) AND ("system_code" IS NOT NULL)) OR (("user_id" IS NOT NULL) AND ("system_code" IS NULL))))
);


ALTER TABLE "public"."record_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."record_category_overrides" (
    "user_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "name" "text",
    "is_hidden" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "record_category_overrides_name_not_blank_check" CHECK ((("name" IS NULL) OR ("btrim"("name") <> ''::"text")))
);


ALTER TABLE "public"."record_category_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transaction_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "transaction_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "account_id" "uuid",
    "asset_id" "uuid",
    "entry_side" "text" NOT NULL,
    "transaction_amount" numeric(30,10) NOT NULL,
    "account_amount" numeric(30,10) NOT NULL,
    "quantity_delta" numeric(30,10),
    "unit_price" numeric(30,10),
    "memo" "text",
    "purity" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cost_basis_delta" numeric(30,10),
    "account_cost_basis_delta" numeric(30,10),
    "account_fx_rate" numeric(30,12),
    "account_fx_effective_at" timestamp with time zone,
    "account_fx_source" "text",
    "input_quantity" numeric(30,10),
    "input_quantity_unit" "text",
    "quantity_conversion_factor" numeric(30,12),
    CONSTRAINT "transaction_entries_account_amount_positive_check" CHECK ((("account_amount" > (0)::numeric) OR (("memo" = 'brokerage_sell_cost_basis'::"text") AND ("asset_id" IS NOT NULL) AND ("account_id" IS NOT NULL) AND ("quantity_delta" = (0)::numeric) AND ("transaction_amount" = (0)::numeric) AND ("cost_basis_delta" < (0)::numeric) AND ("account_cost_basis_delta" < (0)::numeric)))),
    CONSTRAINT "transaction_entries_account_fx_rate_positive_check" CHECK ((("account_fx_rate" IS NULL) OR ("account_fx_rate" > (0)::numeric))),
    CONSTRAINT "transaction_entries_accountless_external_flow_check" CHECK ((("account_id" IS NOT NULL) OR (("memo" = ANY (ARRAY['owner_contribution'::"text", 'owner_draw'::"text", 'metal_purchase_funding'::"text", 'metal_purchase_funding_reversal'::"text", 'existing_holding_opening_equity'::"text", 'existing_holding_opening_equity_reversal'::"text", 'account_disposal_proceeds'::"text", 'expense_refund'::"text", 'expense_refund_cancellation'::"text"])) AND ("asset_id" IS NULL) AND ("quantity_delta" IS NULL) AND ("unit_price" IS NULL) AND ("purity" IS NULL)))),
    CONSTRAINT "transaction_entries_asset_requires_account_effect_check" CHECK ((("asset_id" IS NULL) OR (("account_id" IS NOT NULL) AND (("quantity_delta" IS NOT NULL) OR ("cost_basis_delta" IS NOT NULL))))),
    CONSTRAINT "transaction_entries_entry_side_allowed_check" CHECK (("entry_side" = ANY (ARRAY['debit'::"text", 'credit'::"text"]))),
    CONSTRAINT "transaction_entries_input_quantity_non_zero_check" CHECK ((("input_quantity" IS NULL) OR ("input_quantity" <> (0)::numeric))),
    CONSTRAINT "transaction_entries_input_quantity_unit_allowed_check" CHECK ((("input_quantity_unit" IS NULL) OR ("input_quantity_unit" = ANY (ARRAY['shares'::"text", 'grams'::"text", 'kilograms'::"text", 'troy_ounces'::"text", 'coins'::"text", 'property'::"text", 'ownership_units'::"text", 'currency_amount'::"text", 'units'::"text"])))),
    CONSTRAINT "transaction_entries_quantity_conversion_factor_positive_check" CHECK ((("quantity_conversion_factor" IS NULL) OR ("quantity_conversion_factor" > (0)::numeric))),
    CONSTRAINT "transaction_entries_transaction_amount_positive_check" CHECK ((("transaction_amount" > (0)::numeric) OR (("memo" = 'brokerage_sell_cost_basis'::"text") AND ("asset_id" IS NOT NULL) AND ("account_id" IS NOT NULL) AND ("quantity_delta" = (0)::numeric) AND ("account_amount" = (0)::numeric) AND ("cost_basis_delta" < (0)::numeric) AND ("account_cost_basis_delta" < (0)::numeric))))
);


ALTER TABLE "public"."transaction_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transaction_types" (
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."transaction_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_data_export_rate_limits" (
    "user_id" "uuid" NOT NULL,
    "last_requested_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."user_data_export_rate_limits" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_data_export_rate_limits" IS 'Internal per-user throttle state for Download My Data. Not user export content.';



CREATE TABLE IF NOT EXISTS "public"."wealth_allocation_target_preferences" (
    "user_id" "uuid" NOT NULL,
    "tolerance_percentage" numeric(9,6) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "wealth_allocation_target_preferences_tolerance_percentage_check" CHECK ((("tolerance_percentage" >= (0)::numeric) AND ("tolerance_percentage" <= (100)::numeric)))
);


ALTER TABLE "public"."wealth_allocation_target_preferences" OWNER TO "postgres";


COMMENT ON TABLE "public"."wealth_allocation_target_preferences" IS 'Per-user settings for Wealth Target Allocation; one tolerance applies to the complete plan.';



CREATE TABLE IF NOT EXISTS "public"."wealth_allocation_targets" (
    "user_id" "uuid" NOT NULL,
    "asset_class" "text" NOT NULL,
    "target_percentage" numeric(9,6) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "wealth_allocation_targets_asset_class_check" CHECK (("asset_class" = ANY (ARRAY['cash_and_bank'::"text", 'brokerage'::"text", 'gold_and_silver'::"text", 'real_estate'::"text", 'business'::"text", 'other'::"text"]))),
    CONSTRAINT "wealth_allocation_targets_target_percentage_check" CHECK ((("target_percentage" >= (0)::numeric) AND ("target_percentage" <= (100)::numeric)))
);


ALTER TABLE "public"."wealth_allocation_targets" OWNER TO "postgres";


COMMENT ON TABLE "public"."wealth_allocation_targets" IS 'User-selected Wealth Analysis asset-class targets; zero excludes a class from target comparison.';



ALTER TABLE ONLY "public"."account_disposals"
    ADD CONSTRAINT "account_disposals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."account_disposals"
    ADD CONSTRAINT "account_disposals_proceeds_transaction_unique" UNIQUE ("proceeds_transaction_id");



ALTER TABLE ONLY "public"."account_types"
    ADD CONSTRAINT "account_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."account_valuations"
    ADD CONSTRAINT "account_valuations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."asset_identifiers"
    ADD CONSTRAINT "asset_identifiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."asset_types"
    ADD CONSTRAINT "asset_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."currencies"
    ADD CONSTRAINT "currencies_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."dashboard_valuation_snapshots"
    ADD CONSTRAINT "dashboard_valuation_snapshots_pkey" PRIMARY KEY ("user_id", "base_currency_code");



ALTER TABLE ONLY "public"."exchange_rates"
    ADD CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financial_accounts"
    ADD CONSTRAINT "financial_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financial_transactions"
    ADD CONSTRAINT "financial_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goal_progress_entries"
    ADD CONSTRAINT "goal_progress_entries_id_goal_user_key" UNIQUE ("id", "goal_id", "user_id");



ALTER TABLE ONLY "public"."goal_progress_entries"
    ADD CONSTRAINT "goal_progress_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_id_user_key" UNIQUE ("id", "user_id");



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."holdings"
    ADD CONSTRAINT "holdings_account_asset_key" UNIQUE ("account_id", "asset_id");



ALTER TABLE ONLY "public"."holdings"
    ADD CONSTRAINT "holdings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."market_prices"
    ADD CONSTRAINT "market_prices_owner_asset_provider_as_of_key" UNIQUE NULLS NOT DISTINCT ("user_id", "asset_id", "provider", "as_of");



ALTER TABLE ONLY "public"."market_prices"
    ADD CONSTRAINT "market_prices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."metal_purchase_lifecycle_events"
    ADD CONSTRAINT "metal_purchase_lifecycle_events_one_per_purchase" UNIQUE ("affected_purchase_id");



ALTER TABLE ONLY "public"."metal_purchase_lifecycle_events"
    ADD CONSTRAINT "metal_purchase_lifecycle_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."metal_purchases"
    ADD CONSTRAINT "metal_purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."record_categories"
    ADD CONSTRAINT "record_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."record_categories"
    ADD CONSTRAINT "record_categories_system_code_key" UNIQUE ("system_code");



ALTER TABLE ONLY "public"."record_category_overrides"
    ADD CONSTRAINT "record_category_overrides_pkey" PRIMARY KEY ("user_id", "category_id");



ALTER TABLE ONLY "public"."transaction_entries"
    ADD CONSTRAINT "transaction_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transaction_types"
    ADD CONSTRAINT "transaction_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."user_data_export_rate_limits"
    ADD CONSTRAINT "user_data_export_rate_limits_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."wealth_allocation_target_preferences"
    ADD CONSTRAINT "wealth_allocation_target_preferences_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."wealth_allocation_targets"
    ADD CONSTRAINT "wealth_allocation_targets_pkey" PRIMARY KEY ("user_id", "asset_class");



CREATE INDEX "account_disposals_effective_lookup_idx" ON "public"."account_disposals" USING "btree" ("account_id", "disposed_on", "created_at", "id");



CREATE UNIQUE INDEX "account_disposals_one_direct_correction_idx" ON "public"."account_disposals" USING "btree" ("corrects_disposal_id") WHERE ("corrects_disposal_id" IS NOT NULL);



CREATE UNIQUE INDEX "account_disposals_user_idempotency_key_idx" ON "public"."account_disposals" USING "btree" ("user_id", "idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE INDEX "account_valuations_effective_lookup_idx" ON "public"."account_valuations" USING "btree" ("account_id", "valued_on" DESC, "created_at" DESC);



CREATE UNIQUE INDEX "account_valuations_one_direct_correction_idx" ON "public"."account_valuations" USING "btree" ("corrects_valuation_id") WHERE ("corrects_valuation_id" IS NOT NULL);



CREATE INDEX "asset_identifiers_asset_id_idx" ON "public"."asset_identifiers" USING "btree" ("asset_id");



CREATE UNIQUE INDEX "asset_identifiers_custom_identity_key" ON "public"."asset_identifiers" USING "btree" ("user_id", "scheme", "lower"("btrim"("namespace")), "normalized_value") WHERE ("user_id" IS NOT NULL);



CREATE UNIQUE INDEX "asset_identifiers_global_identity_key" ON "public"."asset_identifiers" USING "btree" ("scheme", "lower"("btrim"("namespace")), "normalized_value") WHERE ("user_id" IS NULL);



CREATE UNIQUE INDEX "asset_identifiers_one_primary_per_asset_key" ON "public"."asset_identifiers" USING "btree" ("asset_id") WHERE "is_primary";



CREATE UNIQUE INDEX "assets_custom_user_exchange_symbol_key" ON "public"."assets" USING "btree" ("user_id", "lower"(COALESCE("exchange", ''::"text")), "lower"("btrim"("symbol"))) WHERE (("user_id" IS NOT NULL) AND ("symbol" IS NOT NULL));



CREATE UNIQUE INDEX "assets_global_exchange_symbol_key" ON "public"."assets" USING "btree" ("lower"(COALESCE("exchange", ''::"text")), "lower"("btrim"("symbol"))) WHERE (("user_id" IS NULL) AND ("symbol" IS NOT NULL));



CREATE INDEX "assets_visible_active_name_idx" ON "public"."assets" USING "btree" ("is_active", "name");



CREATE INDEX "exchange_rates_manual_lookup_idx" ON "public"."exchange_rates" USING "btree" ("user_id", "base_currency_code", "quote_currency_code", "effective_at" DESC, "id" DESC) WHERE (("user_id" IS NOT NULL) AND ("provider" IS NULL));



CREATE UNIQUE INDEX "exchange_rates_manual_pair_effective_key" ON "public"."exchange_rates" USING "btree" ("user_id", "base_currency_code", "quote_currency_code", "effective_at");



CREATE INDEX "exchange_rates_provider_cache_lookup_idx" ON "public"."exchange_rates" USING "btree" ("provider", "base_currency_code", "quote_currency_code", "effective_at" DESC, "fetched_at" DESC, "id" DESC) WHERE (("user_id" IS NULL) AND ("provider" IS NOT NULL));



CREATE UNIQUE INDEX "exchange_rates_provider_pair_effective_key" ON "public"."exchange_rates" USING "btree" ("provider", "base_currency_code", "quote_currency_code", "effective_at");



CREATE UNIQUE INDEX "financial_accounts_non_metal_user_name_lower_key" ON "public"."financial_accounts" USING "btree" ("user_id", "lower"("btrim"("name")), "account_type_code", COALESCE("bank_subtype", ''::"text")) WHERE (("account_type_code" <> 'gold'::"text") AND "is_active");



CREATE INDEX "financial_accounts_user_account_type_code_idx" ON "public"."financial_accounts" USING "btree" ("user_id", "account_type_code");



CREATE UNIQUE INDEX "financial_accounts_user_currency_metal_type_key" ON "public"."financial_accounts" USING "btree" ("user_id", "currency_code", "metal_type") WHERE ("account_type_code" = 'gold'::"text");



CREATE INDEX "financial_accounts_user_id_idx" ON "public"."financial_accounts" USING "btree" ("user_id");



CREATE UNIQUE INDEX "financial_transactions_one_correction_per_transaction_idx" ON "public"."financial_transactions" USING "btree" ("corrects_transaction_id") WHERE ("corrects_transaction_id" IS NOT NULL);



CREATE UNIQUE INDEX "financial_transactions_one_reversal_per_transaction_idx" ON "public"."financial_transactions" USING "btree" ("reverses_transaction_id") WHERE ("reverses_transaction_id" IS NOT NULL);



CREATE INDEX "financial_transactions_refunds_transaction_id_idx" ON "public"."financial_transactions" USING "btree" ("refunds_transaction_id") WHERE ("refunds_transaction_id" IS NOT NULL);



CREATE INDEX "financial_transactions_user_categories_idx" ON "public"."financial_transactions" USING "btree" ("user_id", "main_category_id", "subcategory_id") WHERE ("main_category_id" IS NOT NULL);



CREATE INDEX "financial_transactions_user_occurred_at_desc_idx" ON "public"."financial_transactions" USING "btree" ("user_id", "occurred_at" DESC);



CREATE INDEX "financial_transactions_user_occurred_at_id_desc_idx" ON "public"."financial_transactions" USING "btree" ("user_id", "occurred_at" DESC, "id" DESC);



CREATE UNIQUE INDEX "financial_transactions_user_refund_idempotency_key_idx" ON "public"."financial_transactions" USING "btree" ("user_id", "refund_idempotency_key") WHERE ("refund_idempotency_key" IS NOT NULL);



CREATE INDEX "financial_transactions_user_status_idx" ON "public"."financial_transactions" USING "btree" ("user_id", "status");



CREATE INDEX "goal_progress_entries_goal_date_idx" ON "public"."goal_progress_entries" USING "btree" ("goal_id", "effective_on", "created_at");



CREATE UNIQUE INDEX "goal_progress_entries_one_replacement_idx" ON "public"."goal_progress_entries" USING "btree" ("replacement_for_entry_id") WHERE ("replacement_for_entry_id" IS NOT NULL);



CREATE UNIQUE INDEX "goal_progress_entries_one_reversal_idx" ON "public"."goal_progress_entries" USING "btree" ("reverses_entry_id") WHERE ("reverses_entry_id" IS NOT NULL);



CREATE INDEX "goals_user_status_idx" ON "public"."goals" USING "btree" ("user_id", "status", "archived_at");



CREATE INDEX "holdings_asset_idx" ON "public"."holdings" USING "btree" ("asset_id");



CREATE INDEX "holdings_user_account_idx" ON "public"."holdings" USING "btree" ("user_id", "account_id");



CREATE INDEX "market_prices_asset_as_of_desc_idx" ON "public"."market_prices" USING "btree" ("asset_id", "as_of" DESC, "id" DESC);



CREATE INDEX "market_prices_provider_cache_idx" ON "public"."market_prices" USING "btree" ("asset_id", "provider", "fetched_at" DESC, "id" DESC) WHERE ("user_id" IS NULL);



CREATE INDEX "market_prices_user_asset_as_of_desc_idx" ON "public"."market_prices" USING "btree" ("user_id", "asset_id", "as_of" DESC, "id" DESC);



CREATE INDEX "metal_purchase_lifecycle_events_replacement_idx" ON "public"."metal_purchase_lifecycle_events" USING "btree" ("replacement_purchase_id") WHERE ("replacement_purchase_id" IS NOT NULL);



CREATE INDEX "metal_purchase_lifecycle_events_user_created_idx" ON "public"."metal_purchase_lifecycle_events" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "metal_purchases_account_id_idx" ON "public"."metal_purchases" USING "btree" ("account_id", "purchased_at" DESC);



CREATE UNIQUE INDEX "record_categories_custom_main_name_key" ON "public"."record_categories" USING "btree" ("user_id", "lower"("btrim"("name"))) WHERE (("user_id" IS NOT NULL) AND ("level" = 'main'::"text") AND (NOT "is_archived"));



CREATE UNIQUE INDEX "record_categories_custom_subcategory_name_key" ON "public"."record_categories" USING "btree" ("user_id", "parent_id", "lower"("btrim"("name"))) WHERE (("user_id" IS NOT NULL) AND ("level" = 'subcategory'::"text") AND (NOT "is_archived"));



CREATE INDEX "record_categories_visible_tree_idx" ON "public"."record_categories" USING "btree" ("parent_id", "sort_order", "id");



CREATE INDEX "record_category_overrides_user_idx" ON "public"."record_category_overrides" USING "btree" ("user_id", "category_id");



CREATE INDEX "transaction_entries_account_cash_effect_idx" ON "public"."transaction_entries" USING "btree" ("account_id", "transaction_id") INCLUDE ("entry_side", "account_amount") WHERE (("account_id" IS NOT NULL) AND ("asset_id" IS NULL));



CREATE INDEX "transaction_entries_account_id_idx" ON "public"."transaction_entries" USING "btree" ("account_id") WHERE ("account_id" IS NOT NULL);



CREATE INDEX "transaction_entries_asset_projection_idx" ON "public"."transaction_entries" USING "btree" ("user_id", "account_id", "asset_id", "transaction_id") WHERE ("asset_id" IS NOT NULL);



CREATE INDEX "transaction_entries_transaction_id_idx" ON "public"."transaction_entries" USING "btree" ("transaction_id");



CREATE INDEX "transaction_entries_user_account_record_history_idx" ON "public"."transaction_entries" USING "btree" ("user_id", "account_id", "transaction_id") WHERE ("asset_id" IS NULL);



CREATE INDEX "transaction_entries_user_id_idx" ON "public"."transaction_entries" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "account_disposals_prevent_proceeds_link_changes" BEFORE UPDATE OF "proceeds_account_id", "proceeds_transaction_id" ON "public"."account_disposals" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_account_disposal_proceeds_link_changes"();



CREATE OR REPLACE TRIGGER "account_record_entries_prevent_posted_changes" BEFORE INSERT OR DELETE OR UPDATE ON "public"."transaction_entries" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_posted_account_record_entry_changes"();



CREATE OR REPLACE TRIGGER "account_record_entries_validate_ownership" BEFORE INSERT OR UPDATE ON "public"."transaction_entries" FOR EACH ROW EXECUTE FUNCTION "public"."validate_account_record_entry_ownership"();



CREATE OR REPLACE TRIGGER "account_record_transactions_prevent_posted_changes" BEFORE DELETE OR UPDATE ON "public"."financial_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_posted_account_record_changes"();



CREATE OR REPLACE TRIGGER "account_record_transactions_set_posted_at" BEFORE INSERT OR UPDATE OF "status" ON "public"."financial_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."set_account_record_transaction_posted_at"();



CREATE OR REPLACE TRIGGER "asset_identifiers_prepare" BEFORE INSERT OR UPDATE OF "asset_id", "scheme", "namespace", "value" ON "public"."asset_identifiers" FOR EACH ROW EXECUTE FUNCTION "public"."prepare_asset_identifier"();



CREATE OR REPLACE TRIGGER "asset_identifiers_set_updated_at" BEFORE UPDATE ON "public"."asset_identifiers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "assets_10_prepare_canonical_quantity_unit" BEFORE INSERT OR UPDATE OF "asset_type_code", "symbol", "canonical_quantity_unit" ON "public"."assets" FOR EACH ROW EXECUTE FUNCTION "public"."prepare_asset_canonical_quantity_unit"();



CREATE OR REPLACE TRIGGER "assets_set_updated_at" BEFORE UPDATE ON "public"."assets" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "dashboard_snapshot_account_disposals" AFTER INSERT OR DELETE OR UPDATE ON "public"."account_disposals" FOR EACH ROW EXECUTE FUNCTION "public"."invalidate_dashboard_snapshot_for_row"();



CREATE OR REPLACE TRIGGER "dashboard_snapshot_account_valuations" AFTER INSERT OR DELETE OR UPDATE ON "public"."account_valuations" FOR EACH ROW EXECUTE FUNCTION "public"."invalidate_dashboard_snapshot_for_row"();



CREATE OR REPLACE TRIGGER "dashboard_snapshot_accounts" AFTER INSERT OR DELETE OR UPDATE ON "public"."financial_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."invalidate_dashboard_snapshot_for_row"();



CREATE OR REPLACE TRIGGER "dashboard_snapshot_assets" AFTER INSERT OR DELETE OR UPDATE ON "public"."assets" FOR EACH ROW EXECUTE FUNCTION "public"."invalidate_dashboard_snapshot_for_asset"();



CREATE OR REPLACE TRIGGER "dashboard_snapshot_financial_transactions" AFTER INSERT OR DELETE OR UPDATE ON "public"."financial_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."invalidate_dashboard_snapshot_for_financial_transaction"();



CREATE OR REPLACE TRIGGER "dashboard_snapshot_holdings" AFTER INSERT OR DELETE OR UPDATE ON "public"."holdings" FOR EACH ROW EXECUTE FUNCTION "public"."invalidate_dashboard_snapshot_for_row"();



CREATE OR REPLACE TRIGGER "dashboard_snapshot_manual_prices" AFTER INSERT OR DELETE OR UPDATE ON "public"."market_prices" FOR EACH ROW EXECUTE FUNCTION "public"."invalidate_dashboard_snapshot_for_row"();



CREATE OR REPLACE TRIGGER "dashboard_snapshot_metal_purchases" AFTER INSERT OR DELETE OR UPDATE ON "public"."metal_purchases" FOR EACH ROW EXECUTE FUNCTION "public"."invalidate_dashboard_snapshot_for_row"();



CREATE OR REPLACE TRIGGER "exchange_rates_set_updated_at" BEFORE UPDATE ON "public"."exchange_rates" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "financial_accounts_15_prevent_direct_lifecycle_change" BEFORE UPDATE OF "is_active", "closed_reason", "closed_on" ON "public"."financial_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_direct_account_lifecycle_change"();



CREATE OR REPLACE TRIGGER "financial_accounts_non_market_opening_balance_guard" BEFORE INSERT OR UPDATE ON "public"."financial_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_legacy_non_market_opening_balance_write"();



CREATE OR REPLACE TRIGGER "financial_accounts_set_updated_at" BEFORE UPDATE ON "public"."financial_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "financial_transactions_25_validate_investment_metadata" BEFORE UPDATE OF "status" ON "public"."financial_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."validate_investment_posting_metadata"();



CREATE OR REPLACE TRIGGER "financial_transactions_block_refunded_expense_mutation" BEFORE INSERT ON "public"."financial_transactions" FOR EACH ROW WHEN ((("new"."reverses_transaction_id" IS NOT NULL) OR ("new"."corrects_transaction_id" IS NOT NULL))) EXECUTE FUNCTION "public"."prevent_expense_mutation_with_effective_refunds"();



CREATE OR REPLACE TRIGGER "financial_transactions_set_updated_at" BEFORE UPDATE ON "public"."financial_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "goal_progress_entries_immutable" BEFORE DELETE OR UPDATE ON "public"."goal_progress_entries" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_goal_progress_mutation"();



CREATE OR REPLACE TRIGGER "holdings_set_updated_at" BEFORE UPDATE ON "public"."holdings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "market_prices_05_prepare_metadata" BEFORE INSERT OR UPDATE OF "provider", "fetched_at", "price_type" ON "public"."market_prices" FOR EACH ROW EXECUTE FUNCTION "public"."prepare_market_price_metadata"();



CREATE OR REPLACE TRIGGER "market_prices_10_prevent_future_as_of" BEFORE INSERT OR UPDATE OF "as_of" ON "public"."market_prices" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_future_market_price"();



CREATE OR REPLACE TRIGGER "market_prices_set_updated_at" BEFORE UPDATE ON "public"."market_prices" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "profiles_set_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "record_categories_set_updated_at" BEFORE UPDATE ON "public"."record_categories" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "record_categories_validate_hierarchy" BEFORE INSERT OR UPDATE OF "user_id", "parent_id", "level" ON "public"."record_categories" FOR EACH ROW EXECUTE FUNCTION "public"."validate_record_category_hierarchy"();



CREATE OR REPLACE TRIGGER "record_category_overrides_set_updated_at" BEFORE UPDATE ON "public"."record_category_overrides" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "record_category_overrides_validate_system_category" BEFORE INSERT OR UPDATE OF "category_id" ON "public"."record_category_overrides" FOR EACH ROW EXECUTE FUNCTION "public"."validate_record_category_override"();



CREATE OR REPLACE TRIGGER "transaction_entries_20_prepare_investment_metadata" BEFORE INSERT OR UPDATE ON "public"."transaction_entries" FOR EACH ROW EXECUTE FUNCTION "public"."prepare_investment_entry_metadata"();



CREATE OR REPLACE TRIGGER "transaction_entries_set_updated_at" BEFORE UPDATE ON "public"."transaction_entries" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "wealth_allocation_target_preferences_set_updated_at" BEFORE UPDATE ON "public"."wealth_allocation_target_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "wealth_allocation_targets_set_updated_at" BEFORE UPDATE ON "public"."wealth_allocation_targets" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."account_disposals"
    ADD CONSTRAINT "account_disposals_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."account_disposals"
    ADD CONSTRAINT "account_disposals_corrects_disposal_id_fkey" FOREIGN KEY ("corrects_disposal_id") REFERENCES "public"."account_disposals"("id") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."account_disposals"
    ADD CONSTRAINT "account_disposals_proceeds_account_id_fkey" FOREIGN KEY ("proceeds_account_id") REFERENCES "public"."financial_accounts"("id") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."account_disposals"
    ADD CONSTRAINT "account_disposals_proceeds_transaction_id_fkey" FOREIGN KEY ("proceeds_transaction_id") REFERENCES "public"."financial_transactions"("id") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."account_disposals"
    ADD CONSTRAINT "account_disposals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."account_valuations"
    ADD CONSTRAINT "account_valuations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."account_valuations"
    ADD CONSTRAINT "account_valuations_corrects_valuation_id_fkey" FOREIGN KEY ("corrects_valuation_id") REFERENCES "public"."account_valuations"("id") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."account_valuations"
    ADD CONSTRAINT "account_valuations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."asset_identifiers"
    ADD CONSTRAINT "asset_identifiers_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."asset_identifiers"
    ADD CONSTRAINT "asset_identifiers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_asset_type_code_fkey" FOREIGN KEY ("asset_type_code") REFERENCES "public"."asset_types"("code");



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dashboard_valuation_snapshots"
    ADD CONSTRAINT "dashboard_valuation_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exchange_rates"
    ADD CONSTRAINT "exchange_rates_base_currency_code_fkey" FOREIGN KEY ("base_currency_code") REFERENCES "public"."currencies"("code");



ALTER TABLE ONLY "public"."exchange_rates"
    ADD CONSTRAINT "exchange_rates_quote_currency_code_fkey" FOREIGN KEY ("quote_currency_code") REFERENCES "public"."currencies"("code");



ALTER TABLE ONLY "public"."exchange_rates"
    ADD CONSTRAINT "exchange_rates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."financial_accounts"
    ADD CONSTRAINT "financial_accounts_account_type_code_fkey" FOREIGN KEY ("account_type_code") REFERENCES "public"."account_types"("code");



ALTER TABLE ONLY "public"."financial_accounts"
    ADD CONSTRAINT "financial_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."financial_transactions"
    ADD CONSTRAINT "financial_transactions_corrects_transaction_id_fkey" FOREIGN KEY ("corrects_transaction_id") REFERENCES "public"."financial_transactions"("id") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."financial_transactions"
    ADD CONSTRAINT "financial_transactions_main_category_id_fkey" FOREIGN KEY ("main_category_id") REFERENCES "public"."record_categories"("id") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."financial_transactions"
    ADD CONSTRAINT "financial_transactions_refunds_transaction_id_fkey" FOREIGN KEY ("refunds_transaction_id") REFERENCES "public"."financial_transactions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."financial_transactions"
    ADD CONSTRAINT "financial_transactions_reverses_transaction_id_fkey" FOREIGN KEY ("reverses_transaction_id") REFERENCES "public"."financial_transactions"("id") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."financial_transactions"
    ADD CONSTRAINT "financial_transactions_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "public"."record_categories"("id") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."financial_transactions"
    ADD CONSTRAINT "financial_transactions_transaction_type_code_fkey" FOREIGN KEY ("transaction_type_code") REFERENCES "public"."transaction_types"("code");



ALTER TABLE ONLY "public"."financial_transactions"
    ADD CONSTRAINT "financial_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_progress_entries"
    ADD CONSTRAINT "goal_progress_entries_goal_owner_fkey" FOREIGN KEY ("goal_id", "user_id") REFERENCES "public"."goals"("id", "user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_progress_entries"
    ADD CONSTRAINT "goal_progress_entries_replacement_owner_fkey" FOREIGN KEY ("replacement_for_entry_id", "goal_id", "user_id") REFERENCES "public"."goal_progress_entries"("id", "goal_id", "user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_progress_entries"
    ADD CONSTRAINT "goal_progress_entries_reversal_owner_fkey" FOREIGN KEY ("reverses_entry_id", "goal_id", "user_id") REFERENCES "public"."goal_progress_entries"("id", "goal_id", "user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_progress_entries"
    ADD CONSTRAINT "goal_progress_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."holdings"
    ADD CONSTRAINT "holdings_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."holdings"
    ADD CONSTRAINT "holdings_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."holdings"
    ADD CONSTRAINT "holdings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."market_prices"
    ADD CONSTRAINT "market_prices_asset_id_assets_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."market_prices"
    ADD CONSTRAINT "market_prices_user_id_auth_users_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."metal_purchase_lifecycle_events"
    ADD CONSTRAINT "metal_lifecycle_funding_reversal_tx_fkey" FOREIGN KEY ("funding_reversal_transaction_id") REFERENCES "public"."financial_transactions"("id") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."metal_purchase_lifecycle_events"
    ADD CONSTRAINT "metal_purchase_lifecycle_events_affected_purchase_id_fkey" FOREIGN KEY ("affected_purchase_id") REFERENCES "public"."metal_purchases"("id") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."metal_purchase_lifecycle_events"
    ADD CONSTRAINT "metal_purchase_lifecycle_events_replacement_purchase_id_fkey" FOREIGN KEY ("replacement_purchase_id") REFERENCES "public"."metal_purchases"("id") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."metal_purchase_lifecycle_events"
    ADD CONSTRAINT "metal_purchase_lifecycle_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."metal_purchases"
    ADD CONSTRAINT "metal_purchases_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."metal_purchases"
    ADD CONSTRAINT "metal_purchases_funding_account_id_fkey" FOREIGN KEY ("funding_account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."metal_purchases"
    ADD CONSTRAINT "metal_purchases_funding_transaction_id_fkey" FOREIGN KEY ("funding_transaction_id") REFERENCES "public"."financial_transactions"("id") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."metal_purchases"
    ADD CONSTRAINT "metal_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."record_categories"
    ADD CONSTRAINT "record_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."record_categories"("id") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."record_categories"
    ADD CONSTRAINT "record_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."record_category_overrides"
    ADD CONSTRAINT "record_category_overrides_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."record_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."record_category_overrides"
    ADD CONSTRAINT "record_category_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transaction_entries"
    ADD CONSTRAINT "transaction_entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."transaction_entries"
    ADD CONSTRAINT "transaction_entries_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."transaction_entries"
    ADD CONSTRAINT "transaction_entries_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."financial_transactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transaction_entries"
    ADD CONSTRAINT "transaction_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_data_export_rate_limits"
    ADD CONSTRAINT "user_data_export_rate_limits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wealth_allocation_target_preferences"
    ADD CONSTRAINT "wealth_allocation_target_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wealth_allocation_targets"
    ADD CONSTRAINT "wealth_allocation_targets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."account_disposals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "account_disposals_select_own" ON "public"."account_disposals" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "account_record_entries_select_own" ON "public"."transaction_entries" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "account_record_transaction_types_select" ON "public"."transaction_types" FOR SELECT TO "authenticated" USING ((("code" = ANY (ARRAY['income'::"text", 'expense'::"text", 'transfer'::"text", 'refund'::"text"])) AND "is_active"));



CREATE POLICY "account_record_transactions_select_own" ON "public"."financial_transactions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."account_types" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "account_types_select_active" ON "public"."account_types" FOR SELECT TO "authenticated" USING (("is_active" = true));



ALTER TABLE "public"."account_valuations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "account_valuations_select_own" ON "public"."account_valuations" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."asset_identifiers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "asset_identifiers_select_visible" ON "public"."asset_identifiers" FOR SELECT TO "authenticated" USING ((("user_id" IS NULL) OR ("user_id" = "auth"."uid"())));



ALTER TABLE "public"."asset_types" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "asset_types_select_active" ON "public"."asset_types" FOR SELECT TO "authenticated" USING ("is_active");



ALTER TABLE "public"."assets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "assets_delete_custom" ON "public"."assets" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND "is_custom"));



CREATE POLICY "assets_insert_custom" ON "public"."assets" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND "is_custom"));



CREATE POLICY "assets_select_visible" ON "public"."assets" FOR SELECT TO "authenticated" USING ((("user_id" IS NULL) OR ("user_id" = "auth"."uid"())));



CREATE POLICY "assets_update_custom" ON "public"."assets" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND "is_custom")) WITH CHECK ((("user_id" = "auth"."uid"()) AND "is_custom"));



ALTER TABLE "public"."currencies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "currencies_select_active" ON "public"."currencies" FOR SELECT TO "authenticated" USING ("is_active");



ALTER TABLE "public"."dashboard_valuation_snapshots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dashboard_valuation_snapshots_select_own" ON "public"."dashboard_valuation_snapshots" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."exchange_rates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "exchange_rates_delete_own_manual" ON "public"."exchange_rates" FOR DELETE TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("provider" IS NULL)));



CREATE POLICY "exchange_rates_insert_own_manual" ON "public"."exchange_rates" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("provider" IS NULL) AND ("source" = 'manual'::"text") AND ("fetched_at" IS NULL)));



CREATE POLICY "exchange_rates_select_visible" ON "public"."exchange_rates" FOR SELECT TO "authenticated" USING ((("provider" = 'frankfurter'::"text") OR ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "exchange_rates_update_own_manual" ON "public"."exchange_rates" FOR UPDATE TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("provider" IS NULL))) WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("provider" IS NULL) AND ("source" = 'manual'::"text") AND ("fetched_at" IS NULL)));



ALTER TABLE "public"."financial_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "financial_accounts_insert_own" ON "public"."financial_accounts" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "financial_accounts_select_own" ON "public"."financial_accounts" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "financial_accounts_update_own" ON "public"."financial_accounts" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."financial_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."goal_progress_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "goal_progress_entries_select_own" ON "public"."goal_progress_entries" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."goals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "goals_select_own" ON "public"."goals" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."holdings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "holdings_select_own" ON "public"."holdings" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."market_prices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "market_prices_delete_own_manual" ON "public"."market_prices" FOR DELETE TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("provider" = 'manual'::"text")));



CREATE POLICY "market_prices_insert_own_manual" ON "public"."market_prices" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("provider" = 'manual'::"text") AND ("price_type" = 'manual'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."assets"
  WHERE (("assets"."id" = "market_prices"."asset_id") AND (("assets"."user_id" IS NULL) OR ("assets"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "market_prices_select_visible_or_owned" ON "public"."market_prices" FOR SELECT TO "authenticated" USING (((("user_id" IS NULL) OR ("user_id" = ( SELECT "auth"."uid"() AS "uid"))) AND (EXISTS ( SELECT 1
   FROM "public"."assets"
  WHERE (("assets"."id" = "market_prices"."asset_id") AND (("assets"."user_id" IS NULL) OR ("assets"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "market_prices_update_own_manual" ON "public"."market_prices" FOR UPDATE TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("provider" = 'manual'::"text"))) WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("provider" = 'manual'::"text") AND ("price_type" = 'manual'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."assets"
  WHERE (("assets"."id" = "market_prices"."asset_id") AND (("assets"."user_id" IS NULL) OR ("assets"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



ALTER TABLE "public"."metal_purchase_lifecycle_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "metal_purchase_lifecycle_events_select_own" ON "public"."metal_purchase_lifecycle_events" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."metal_purchases" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "metal_purchases_insert_own" ON "public"."metal_purchases" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "metal_purchases_select_own" ON "public"."metal_purchases" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



ALTER TABLE "public"."record_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "record_categories_insert_own" ON "public"."record_categories" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND ("system_code" IS NULL)));



CREATE POLICY "record_categories_select_visible" ON "public"."record_categories" FOR SELECT TO "authenticated" USING ((("user_id" IS NULL) OR ("user_id" = "auth"."uid"())));



CREATE POLICY "record_categories_update_own" ON "public"."record_categories" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK ((("user_id" = "auth"."uid"()) AND ("system_code" IS NULL)));



ALTER TABLE "public"."record_category_overrides" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "record_category_overrides_delete_own" ON "public"."record_category_overrides" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "record_category_overrides_insert_own" ON "public"."record_category_overrides" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "record_category_overrides_select_own" ON "public"."record_category_overrides" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "record_category_overrides_update_own" ON "public"."record_category_overrides" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."transaction_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transaction_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_data_export_rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wealth_allocation_target_preferences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wealth_allocation_target_preferences_select_own" ON "public"."wealth_allocation_target_preferences" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."wealth_allocation_targets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wealth_allocation_targets_select_own" ON "public"."wealth_allocation_targets" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."account_disposals" TO "authenticated";
GRANT ALL ON TABLE "public"."account_disposals" TO "service_role";



REVOKE ALL ON FUNCTION "public"."add_account_disposal"("p_account_id" "uuid", "p_disposed_on" "date", "p_sale_amount" numeric, "p_sale_currency_code" "text", "p_ownership_percentage_sold" numeric, "p_idempotency_key" "uuid", "p_notes" "text", "p_destination_account_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_account_disposal"("p_account_id" "uuid", "p_disposed_on" "date", "p_sale_amount" numeric, "p_sale_currency_code" "text", "p_ownership_percentage_sold" numeric, "p_idempotency_key" "uuid", "p_notes" "text", "p_destination_account_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_account_disposal"("p_account_id" "uuid", "p_disposed_on" "date", "p_sale_amount" numeric, "p_sale_currency_code" "text", "p_ownership_percentage_sold" numeric, "p_idempotency_key" "uuid", "p_notes" "text", "p_destination_account_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."add_account_record"("p_record_type" "text", "p_account_id" "uuid", "p_counterparty_account_id" "uuid", "p_amount" numeric, "p_received_amount" numeric, "p_occurred_at" timestamp with time zone, "p_category" "text", "p_notes" "text", "p_main_category_id" "uuid", "p_subcategory_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_account_record"("p_record_type" "text", "p_account_id" "uuid", "p_counterparty_account_id" "uuid", "p_amount" numeric, "p_received_amount" numeric, "p_occurred_at" timestamp with time zone, "p_category" "text", "p_notes" "text", "p_main_category_id" "uuid", "p_subcategory_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_account_record"("p_record_type" "text", "p_account_id" "uuid", "p_counterparty_account_id" "uuid", "p_amount" numeric, "p_received_amount" numeric, "p_occurred_at" timestamp with time zone, "p_category" "text", "p_notes" "text", "p_main_category_id" "uuid", "p_subcategory_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."add_account_record_linked"("p_record_type" "text", "p_account_id" "uuid", "p_counterparty_account_id" "uuid", "p_amount" numeric, "p_received_amount" numeric, "p_occurred_at" timestamp with time zone, "p_category" "text", "p_notes" "text", "p_main_category_id" "uuid", "p_subcategory_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_account_record_linked"("p_record_type" "text", "p_account_id" "uuid", "p_counterparty_account_id" "uuid", "p_amount" numeric, "p_received_amount" numeric, "p_occurred_at" timestamp with time zone, "p_category" "text", "p_notes" "text", "p_main_category_id" "uuid", "p_subcategory_id" "uuid") TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."account_valuations" TO "authenticated";
GRANT ALL ON TABLE "public"."account_valuations" TO "service_role";



REVOKE ALL ON FUNCTION "public"."add_account_valuation"("p_account_id" "uuid", "p_valuation_amount" numeric, "p_valued_on" "date", "p_valuation_method" "text", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_account_valuation"("p_account_id" "uuid", "p_valuation_amount" numeric, "p_valued_on" "date", "p_valuation_method" "text", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_account_valuation"("p_account_id" "uuid", "p_valuation_amount" numeric, "p_valued_on" "date", "p_valuation_method" "text", "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."add_brokerage_buy"("p_account_id" "uuid", "p_asset_id" "uuid", "p_quantity" numeric, "p_unit_price" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_fees" numeric, "p_account_fx_rate" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_brokerage_buy"("p_account_id" "uuid", "p_asset_id" "uuid", "p_quantity" numeric, "p_unit_price" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_fees" numeric, "p_account_fx_rate" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_brokerage_buy"("p_account_id" "uuid", "p_asset_id" "uuid", "p_quantity" numeric, "p_unit_price" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_fees" numeric, "p_account_fx_rate" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."add_brokerage_cash_dividend"("p_account_id" "uuid", "p_asset_id" "uuid", "p_gross_dividend" numeric, "p_withholding_tax" numeric, "p_fees" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_brokerage_cash_dividend"("p_account_id" "uuid", "p_asset_id" "uuid", "p_gross_dividend" numeric, "p_withholding_tax" numeric, "p_fees" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_brokerage_cash_dividend"("p_account_id" "uuid", "p_asset_id" "uuid", "p_gross_dividend" numeric, "p_withholding_tax" numeric, "p_fees" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."add_brokerage_cash_transfer"("p_source_account_id" "uuid", "p_destination_account_id" "uuid", "p_amount" numeric, "p_received_amount" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_brokerage_cash_transfer"("p_source_account_id" "uuid", "p_destination_account_id" "uuid", "p_amount" numeric, "p_received_amount" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_brokerage_cash_transfer"("p_source_account_id" "uuid", "p_destination_account_id" "uuid", "p_amount" numeric, "p_received_amount" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."add_brokerage_dividend_reinvestment"("p_account_id" "uuid", "p_asset_id" "uuid", "p_gross_dividend" numeric, "p_withholding_tax" numeric, "p_fees" numeric, "p_unit_price" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_brokerage_dividend_reinvestment"("p_account_id" "uuid", "p_asset_id" "uuid", "p_gross_dividend" numeric, "p_withholding_tax" numeric, "p_fees" numeric, "p_unit_price" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_brokerage_dividend_reinvestment"("p_account_id" "uuid", "p_asset_id" "uuid", "p_gross_dividend" numeric, "p_withholding_tax" numeric, "p_fees" numeric, "p_unit_price" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."add_brokerage_partial_dividend_reinvestment"("p_account_id" "uuid", "p_asset_id" "uuid", "p_gross_dividend" numeric, "p_withholding_tax" numeric, "p_fees" numeric, "p_reinvested_amount" numeric, "p_unit_price" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_brokerage_partial_dividend_reinvestment"("p_account_id" "uuid", "p_asset_id" "uuid", "p_gross_dividend" numeric, "p_withholding_tax" numeric, "p_fees" numeric, "p_reinvested_amount" numeric, "p_unit_price" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_brokerage_partial_dividend_reinvestment"("p_account_id" "uuid", "p_asset_id" "uuid", "p_gross_dividend" numeric, "p_withholding_tax" numeric, "p_fees" numeric, "p_reinvested_amount" numeric, "p_unit_price" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."add_brokerage_sell"("p_account_id" "uuid", "p_asset_id" "uuid", "p_quantity" numeric, "p_unit_sale_price" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_fees" numeric, "p_account_fx_rate" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_brokerage_sell"("p_account_id" "uuid", "p_asset_id" "uuid", "p_quantity" numeric, "p_unit_sale_price" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_fees" numeric, "p_account_fx_rate" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_brokerage_sell"("p_account_id" "uuid", "p_asset_id" "uuid", "p_quantity" numeric, "p_unit_sale_price" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_fees" numeric, "p_account_fx_rate" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."add_existing_holding"("p_account_id" "uuid", "p_asset_id" "uuid", "p_quantity" numeric, "p_average_cost" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_account_fx_rate" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_existing_holding"("p_account_id" "uuid", "p_asset_id" "uuid", "p_quantity" numeric, "p_average_cost" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_account_fx_rate" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_existing_holding"("p_account_id" "uuid", "p_asset_id" "uuid", "p_quantity" numeric, "p_average_cost" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_account_fx_rate" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."add_expense_refund"("p_expense_transaction_id" "uuid", "p_amount" numeric, "p_occurred_at" timestamp with time zone, "p_idempotency_key" "uuid", "p_destination_account_id" "uuid", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_expense_refund"("p_expense_transaction_id" "uuid", "p_amount" numeric, "p_occurred_at" timestamp with time zone, "p_idempotency_key" "uuid", "p_destination_account_id" "uuid", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_expense_refund"("p_expense_transaction_id" "uuid", "p_amount" numeric, "p_occurred_at" timestamp with time zone, "p_idempotency_key" "uuid", "p_destination_account_id" "uuid", "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."add_goal_progress_entry"("p_goal_id" "uuid", "p_entry_type" "text", "p_amount" numeric, "p_effective_on" "date", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_goal_progress_entry"("p_goal_id" "uuid", "p_entry_type" "text", "p_amount" numeric, "p_effective_on" "date", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_goal_progress_entry"("p_goal_id" "uuid", "p_entry_type" "text", "p_amount" numeric, "p_effective_on" "date", "p_note" "text") TO "service_role";



GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."financial_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."financial_accounts" TO "service_role";



REVOKE ALL ON FUNCTION "public"."add_metal_purchase"("p_account_id" "uuid", "p_purity" "text", "p_occurred_at" timestamp with time zone, "p_quantity_grams" numeric, "p_cost_per_unit" numeric, "p_funding_mode" "text", "p_funding_account_id" "uuid", "p_fees" numeric, "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_metal_purchase"("p_account_id" "uuid", "p_purity" "text", "p_occurred_at" timestamp with time zone, "p_quantity_grams" numeric, "p_cost_per_unit" numeric, "p_funding_mode" "text", "p_funding_account_id" "uuid", "p_fees" numeric, "p_notes" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."add_metal_purchase"("p_account_id" "uuid", "p_purity" "text", "p_occurred_at" timestamp with time zone, "p_quantity_grams" numeric, "p_cost_per_unit" numeric, "p_funding_mode" "text", "p_funding_account_id" "uuid", "p_fees" numeric, "p_notes" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."assert_account_record_transaction_balanced"("p_transaction_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assert_account_record_transaction_balanced"("p_transaction_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."assert_visible_record_category_selection"("p_user_id" "uuid", "p_main_category_id" "uuid", "p_subcategory_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assert_visible_record_category_selection"("p_user_id" "uuid", "p_main_category_id" "uuid", "p_subcategory_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cancel_expense_refund"("p_refund_transaction_id" "uuid", "p_idempotency_key" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_expense_refund"("p_refund_transaction_id" "uuid", "p_idempotency_key" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_expense_refund"("p_refund_transaction_id" "uuid", "p_idempotency_key" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."close_financial_account"("p_account_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."close_financial_account"("p_account_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."close_financial_account"("p_account_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."complete_onboarding"("p_country_code" "text", "p_base_currency_code" "text", "p_selected_goals" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."complete_onboarding"("p_country_code" "text", "p_base_currency_code" "text", "p_selected_goals" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_onboarding"("p_country_code" "text", "p_base_currency_code" "text", "p_selected_goals" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."correct_account_disposal"("p_disposal_id" "uuid", "p_disposed_on" "date", "p_sale_amount" numeric, "p_sale_currency_code" "text", "p_ownership_percentage_sold" numeric, "p_notes" "text", "p_destination_account_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."correct_account_disposal"("p_disposal_id" "uuid", "p_disposed_on" "date", "p_sale_amount" numeric, "p_sale_currency_code" "text", "p_ownership_percentage_sold" numeric, "p_notes" "text", "p_destination_account_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."correct_account_disposal"("p_disposal_id" "uuid", "p_disposed_on" "date", "p_sale_amount" numeric, "p_sale_currency_code" "text", "p_ownership_percentage_sold" numeric, "p_notes" "text", "p_destination_account_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."correct_account_record"("p_transaction_id" "uuid", "p_record_type" "text", "p_account_id" "uuid", "p_counterparty_account_id" "uuid", "p_amount" numeric, "p_received_amount" numeric, "p_occurred_at" timestamp with time zone, "p_category" "text", "p_notes" "text", "p_main_category_id" "uuid", "p_subcategory_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."correct_account_record"("p_transaction_id" "uuid", "p_record_type" "text", "p_account_id" "uuid", "p_counterparty_account_id" "uuid", "p_amount" numeric, "p_received_amount" numeric, "p_occurred_at" timestamp with time zone, "p_category" "text", "p_notes" "text", "p_main_category_id" "uuid", "p_subcategory_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."correct_account_record"("p_transaction_id" "uuid", "p_record_type" "text", "p_account_id" "uuid", "p_counterparty_account_id" "uuid", "p_amount" numeric, "p_received_amount" numeric, "p_occurred_at" timestamp with time zone, "p_category" "text", "p_notes" "text", "p_main_category_id" "uuid", "p_subcategory_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."correct_account_valuation"("p_valuation_id" "uuid", "p_valuation_amount" numeric, "p_valued_on" "date", "p_valuation_method" "text", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."correct_account_valuation"("p_valuation_id" "uuid", "p_valuation_amount" numeric, "p_valued_on" "date", "p_valuation_method" "text", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."correct_account_valuation"("p_valuation_id" "uuid", "p_valuation_amount" numeric, "p_valued_on" "date", "p_valuation_method" "text", "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."correct_existing_holding"("p_original_transaction_id" "uuid", "p_quantity" numeric, "p_average_cost" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_account_fx_rate" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."correct_existing_holding"("p_original_transaction_id" "uuid", "p_quantity" numeric, "p_average_cost" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_account_fx_rate" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."correct_existing_holding"("p_original_transaction_id" "uuid", "p_quantity" numeric, "p_average_cost" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_account_fx_rate" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."correct_goal_progress_entry"("p_entry_id" "uuid", "p_replacement_amount" numeric, "p_replacement_effective_on" "date", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."correct_goal_progress_entry"("p_entry_id" "uuid", "p_replacement_amount" numeric, "p_replacement_effective_on" "date", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."correct_goal_progress_entry"("p_entry_id" "uuid", "p_replacement_amount" numeric, "p_replacement_effective_on" "date", "p_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."correct_metal_purchase"("p_purchase_id" "uuid", "p_purity" "text", "p_occurred_at" timestamp with time zone, "p_quantity_grams" numeric, "p_cost_per_unit" numeric, "p_funding_mode" "text", "p_funding_account_id" "uuid", "p_fees" numeric, "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."correct_metal_purchase"("p_purchase_id" "uuid", "p_purity" "text", "p_occurred_at" timestamp with time zone, "p_quantity_grams" numeric, "p_cost_per_unit" numeric, "p_funding_mode" "text", "p_funding_account_id" "uuid", "p_fees" numeric, "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."correct_metal_purchase"("p_purchase_id" "uuid", "p_purity" "text", "p_occurred_at" timestamp with time zone, "p_quantity_grams" numeric, "p_cost_per_unit" numeric, "p_funding_mode" "text", "p_funding_account_id" "uuid", "p_fees" numeric, "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_goal"("p_name" "text", "p_goal_type" "text", "p_custom_type_name" "text", "p_target_amount" numeric, "p_currency_code" "text", "p_target_date" "date", "p_saved_so_far" numeric, "p_saved_on" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_goal"("p_name" "text", "p_goal_type" "text", "p_custom_type_name" "text", "p_target_amount" numeric, "p_currency_code" "text", "p_target_date" "date", "p_saved_so_far" numeric, "p_saved_on" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_goal"("p_name" "text", "p_goal_type" "text", "p_custom_type_name" "text", "p_target_amount" numeric, "p_currency_code" "text", "p_target_date" "date", "p_saved_so_far" numeric, "p_saved_on" "date") TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."metal_purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."metal_purchases" TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_metal_purchase_internal"("p_user_id" "uuid", "p_account_id" "uuid", "p_purity" "text", "p_occurred_at" timestamp with time zone, "p_quantity_grams" numeric, "p_cost_per_unit" numeric, "p_funding_mode" "text", "p_funding_account_id" "uuid", "p_fees" numeric, "p_notes" "text", "p_corrects_funding_transaction_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_metal_purchase_internal"("p_user_id" "uuid", "p_account_id" "uuid", "p_purity" "text", "p_occurred_at" timestamp with time zone, "p_quantity_grams" numeric, "p_cost_per_unit" numeric, "p_funding_mode" "text", "p_funding_account_id" "uuid", "p_fees" numeric, "p_notes" "text", "p_corrects_funding_transaction_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_valued_account"("p_account_type_code" "text", "p_name" "text", "p_currency_code" "text", "p_property_type" "text", "p_business_type" "text", "p_industry" "text", "p_ownership_percentage" numeric, "p_location" "text", "p_account_notes" "text", "p_valuation_amount" numeric, "p_valued_on" "date", "p_valuation_method" "text", "p_valuation_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_valued_account"("p_account_type_code" "text", "p_name" "text", "p_currency_code" "text", "p_property_type" "text", "p_business_type" "text", "p_industry" "text", "p_ownership_percentage" numeric, "p_location" "text", "p_account_notes" "text", "p_valuation_amount" numeric, "p_valued_on" "date", "p_valuation_method" "text", "p_valuation_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_valued_account"("p_account_type_code" "text", "p_name" "text", "p_currency_code" "text", "p_property_type" "text", "p_business_type" "text", "p_industry" "text", "p_ownership_percentage" numeric, "p_location" "text", "p_account_notes" "text", "p_valuation_amount" numeric, "p_valued_on" "date", "p_valuation_method" "text", "p_valuation_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_goal"("p_goal_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_goal"("p_goal_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_goal"("p_goal_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_pristine_financial_account"("p_account_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_pristine_financial_account"("p_account_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_pristine_financial_account"("p_account_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."export_my_data_v1"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."export_my_data_v1"() TO "service_role";
GRANT ALL ON FUNCTION "public"."export_my_data_v1"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_account_balances"("p_account_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_account_balances"("p_account_ids" "uuid"[]) TO "service_role";
GRANT ALL ON FUNCTION "public"."get_account_balances"("p_account_ids" "uuid"[]) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_account_current_ownership"("p_account_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_account_current_ownership"("p_account_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_account_current_ownership"("p_account_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_account_disposals"("p_account_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_account_disposals"("p_account_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_account_disposals"("p_account_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_account_lifecycle_eligibility"("p_account_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_account_lifecycle_eligibility"("p_account_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_account_lifecycle_eligibility"("p_account_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_account_lifecycle_state"("p_account_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_account_lifecycle_state"("p_account_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_account_record_history"("p_account_id" "uuid", "p_cursor_occurred_at" timestamp with time zone, "p_cursor_id" "uuid", "p_page_size" integer, "p_time_zone" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_account_record_history"("p_account_id" "uuid", "p_cursor_occurred_at" timestamp with time zone, "p_cursor_id" "uuid", "p_page_size" integer, "p_time_zone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_account_record_history"("p_account_id" "uuid", "p_cursor_occurred_at" timestamp with time zone, "p_cursor_id" "uuid", "p_page_size" integer, "p_time_zone" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_account_record_history"("p_account_id" "uuid", "p_cursor_occurred_at" timestamp with time zone, "p_cursor_id" "uuid", "p_page_size" integer, "p_time_zone" "text", "p_search" "text", "p_from_date" "date", "p_to_date" "date", "p_record_type" "text", "p_main_category_id" "uuid", "p_subcategory_id" "uuid", "p_min_amount" numeric, "p_max_amount" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_account_record_history"("p_account_id" "uuid", "p_cursor_occurred_at" timestamp with time zone, "p_cursor_id" "uuid", "p_page_size" integer, "p_time_zone" "text", "p_search" "text", "p_from_date" "date", "p_to_date" "date", "p_record_type" "text", "p_main_category_id" "uuid", "p_subcategory_id" "uuid", "p_min_amount" numeric, "p_max_amount" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_account_record_history"("p_account_id" "uuid", "p_cursor_occurred_at" timestamp with time zone, "p_cursor_id" "uuid", "p_page_size" integer, "p_time_zone" "text", "p_search" "text", "p_from_date" "date", "p_to_date" "date", "p_record_type" "text", "p_main_category_id" "uuid", "p_subcategory_id" "uuid", "p_min_amount" numeric, "p_max_amount" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_brokerage_available_cash"("p_account_id" "uuid", "p_required_cash" numeric, "p_lock_account" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_brokerage_available_cash"("p_account_id" "uuid", "p_required_cash" numeric, "p_lock_account" boolean) TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."market_prices" TO "authenticated";
GRANT ALL ON TABLE "public"."market_prices" TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_current_market_price"("p_asset_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_current_market_price"("p_asset_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_current_market_price"("p_asset_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_effective_account_valuations"("p_account_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_effective_account_valuations"("p_account_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_effective_account_valuations"("p_account_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_effective_metal_purchases"("p_account_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_effective_metal_purchases"("p_account_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_effective_metal_purchases"("p_account_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_expense_refund_summary"("p_expense_transaction_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_expense_refund_summary"("p_expense_transaction_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_expense_refund_summary"("p_expense_transaction_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."goal_funded_amount"("p_goal_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."goal_funded_amount"("p_goal_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."invalidate_dashboard_snapshot_for_asset"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."invalidate_dashboard_snapshot_for_asset"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."invalidate_dashboard_snapshot_for_financial_transaction"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."invalidate_dashboard_snapshot_for_financial_transaction"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."invalidate_dashboard_snapshot_for_row"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."invalidate_dashboard_snapshot_for_row"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."invalidate_dashboard_valuation_snapshots"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."invalidate_dashboard_valuation_snapshots"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."post_account_disposal_proceeds_internal"("p_disposal_id" "uuid", "p_source_account_type" "text", "p_destination_account_id" "uuid", "p_sale_amount" numeric, "p_sale_currency_code" "text", "p_disposed_on" "date", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."post_account_disposal_proceeds_internal"("p_disposal_id" "uuid", "p_source_account_type" "text", "p_destination_account_id" "uuid", "p_sale_amount" numeric, "p_sale_currency_code" "text", "p_disposed_on" "date", "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."post_account_record_internal"("p_record_type" "text", "p_account_id" "uuid", "p_counterparty_account_id" "uuid", "p_amount" numeric, "p_received_amount" numeric, "p_occurred_at" timestamp with time zone, "p_category" "text", "p_notes" "text", "p_main_category_id" "uuid", "p_subcategory_id" "uuid", "p_reverses_transaction_id" "uuid", "p_corrects_transaction_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."post_account_record_internal"("p_record_type" "text", "p_account_id" "uuid", "p_counterparty_account_id" "uuid", "p_amount" numeric, "p_received_amount" numeric, "p_occurred_at" timestamp with time zone, "p_category" "text", "p_notes" "text", "p_main_category_id" "uuid", "p_subcategory_id" "uuid", "p_reverses_transaction_id" "uuid", "p_corrects_transaction_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."post_account_record_internal"("p_record_type" "text", "p_account_id" "uuid", "p_counterparty_account_id" "uuid", "p_amount" numeric, "p_received_amount" numeric, "p_occurred_at" timestamp with time zone, "p_category" "text", "p_notes" "text", "p_main_category_id" "uuid", "p_subcategory_id" "uuid", "p_reverses_transaction_id" "uuid", "p_corrects_transaction_id" "uuid", "p_transaction_amount" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."post_account_record_internal"("p_record_type" "text", "p_account_id" "uuid", "p_counterparty_account_id" "uuid", "p_amount" numeric, "p_received_amount" numeric, "p_occurred_at" timestamp with time zone, "p_category" "text", "p_notes" "text", "p_main_category_id" "uuid", "p_subcategory_id" "uuid", "p_reverses_transaction_id" "uuid", "p_corrects_transaction_id" "uuid", "p_transaction_amount" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."post_brokerage_buy_internal"("p_account_id" "uuid", "p_asset_id" "uuid", "p_quantity" numeric, "p_unit_price" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_fees" numeric, "p_account_fx_rate" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."post_brokerage_buy_internal"("p_account_id" "uuid", "p_asset_id" "uuid", "p_quantity" numeric, "p_unit_price" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_fees" numeric, "p_account_fx_rate" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."post_brokerage_cash_transfer_internal"("p_source_account_id" "uuid", "p_destination_account_id" "uuid", "p_amount" numeric, "p_received_amount" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_reverses_transaction_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."post_brokerage_cash_transfer_internal"("p_source_account_id" "uuid", "p_destination_account_id" "uuid", "p_amount" numeric, "p_received_amount" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_reverses_transaction_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."post_brokerage_sell_internal"("p_account_id" "uuid", "p_asset_id" "uuid", "p_quantity" numeric, "p_unit_sale_price" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_fees" numeric, "p_account_fx_rate" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."post_brokerage_sell_internal"("p_account_id" "uuid", "p_asset_id" "uuid", "p_quantity" numeric, "p_unit_sale_price" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_fees" numeric, "p_account_fx_rate" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."post_existing_holding_internal"("p_account_id" "uuid", "p_asset_id" "uuid", "p_quantity" numeric, "p_average_cost" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_account_fx_rate" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."post_existing_holding_internal"("p_account_id" "uuid", "p_asset_id" "uuid", "p_quantity" numeric, "p_average_cost" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_account_fx_rate" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."post_existing_holding_with_links_internal"("p_account_id" "uuid", "p_asset_id" "uuid", "p_quantity" numeric, "p_average_cost" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_account_fx_rate" numeric, "p_corrects_transaction_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."post_existing_holding_with_links_internal"("p_account_id" "uuid", "p_asset_id" "uuid", "p_quantity" numeric, "p_average_cost" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text", "p_account_fx_rate" numeric, "p_corrects_transaction_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."financial_transactions" TO "service_role";
GRANT SELECT ON TABLE "public"."financial_transactions" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."post_transaction"("transaction_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."post_transaction"("transaction_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."post_transaction"("transaction_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."prepare_asset_canonical_quantity_unit"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prepare_asset_canonical_quantity_unit"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."prepare_asset_identifier"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prepare_asset_identifier"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."prepare_investment_entry_metadata"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prepare_investment_entry_metadata"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."prepare_market_price_metadata"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prepare_market_price_metadata"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."prevent_account_disposal_proceeds_link_changes"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prevent_account_disposal_proceeds_link_changes"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."prevent_direct_account_lifecycle_change"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prevent_direct_account_lifecycle_change"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."prevent_expense_mutation_with_effective_refunds"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prevent_expense_mutation_with_effective_refunds"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."prevent_future_market_price"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prevent_future_market_price"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."prevent_goal_progress_mutation"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prevent_goal_progress_mutation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_legacy_non_market_opening_balance_write"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_legacy_non_market_opening_balance_write"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_legacy_non_market_opening_balance_write"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."prevent_posted_account_record_changes"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prevent_posted_account_record_changes"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."prevent_posted_account_record_entry_changes"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prevent_posted_account_record_entry_changes"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."quantity_conversion_factor"("p_input_unit" "text", "p_canonical_unit" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."quantity_conversion_factor"("p_input_unit" "text", "p_canonical_unit" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rebuild_holding_projection"("p_user_id" "uuid", "p_account_id" "uuid", "p_asset_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rebuild_holding_projection"("p_user_id" "uuid", "p_account_id" "uuid", "p_asset_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."recalculate_account_disposal_projection"("p_account_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recalculate_account_disposal_projection"("p_account_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."recalculate_metal_purchase_account_internal"("p_user_id" "uuid", "p_account_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recalculate_metal_purchase_account_internal"("p_user_id" "uuid", "p_account_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reopen_financial_account"("p_account_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reopen_financial_account"("p_account_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reopen_financial_account"("p_account_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."replace_wealth_allocation_plan"("p_targets" "jsonb", "p_tolerance_percentage" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."replace_wealth_allocation_plan"("p_targets" "jsonb", "p_tolerance_percentage" numeric) TO "service_role";
GRANT ALL ON FUNCTION "public"."replace_wealth_allocation_plan"("p_targets" "jsonb", "p_tolerance_percentage" numeric) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."replace_wealth_allocation_targets"("p_targets" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."replace_wealth_allocation_targets"("p_targets" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."replace_wealth_allocation_targets"("p_targets" "jsonb") TO "authenticated";



GRANT ALL ON TABLE "public"."assets" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."assets" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."resolve_external_brokerage_asset"("p_symbol" "text", "p_name" "text", "p_mic_code" "text", "p_display_exchange" "text", "p_country" "text", "p_currency_code" "text", "p_instrument_type" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resolve_external_brokerage_asset"("p_symbol" "text", "p_name" "text", "p_mic_code" "text", "p_display_exchange" "text", "p_country" "text", "p_currency_code" "text", "p_instrument_type" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."resolve_external_brokerage_asset"("p_symbol" "text", "p_name" "text", "p_mic_code" "text", "p_display_exchange" "text", "p_country" "text", "p_currency_code" "text", "p_instrument_type" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."resolve_historical_exchange_rate"("p_source_currency_code" "text", "p_destination_currency_code" "text", "p_requested_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resolve_historical_exchange_rate"("p_source_currency_code" "text", "p_destination_currency_code" "text", "p_requested_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_historical_exchange_rate"("p_source_currency_code" "text", "p_destination_currency_code" "text", "p_requested_at" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."reverse_account_record"("p_transaction_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reverse_account_record"("p_transaction_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reverse_account_record"("p_transaction_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reverse_brokerage_cash_transfer"("p_transaction_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reverse_brokerage_cash_transfer"("p_transaction_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reverse_brokerage_cash_transfer"("p_transaction_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reverse_existing_holding"("p_transaction_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reverse_existing_holding"("p_transaction_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reverse_existing_holding"("p_transaction_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reverse_metal_purchase"("p_purchase_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reverse_metal_purchase"("p_purchase_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reverse_metal_purchase"("p_purchase_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reverse_metal_purchase_funding_internal"("p_user_id" "uuid", "p_purchase" "public"."metal_purchases") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reverse_metal_purchase_funding_internal"("p_user_id" "uuid", "p_purchase" "public"."metal_purchases") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_account_record_transaction_posted_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_account_record_transaction_posted_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_goal_archived"("p_goal_id" "uuid", "p_archived" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_goal_archived"("p_goal_id" "uuid", "p_archived" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_goal_archived"("p_goal_id" "uuid", "p_archived" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_goal_status"("p_goal_id" "uuid", "p_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_goal_status"("p_goal_id" "uuid", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_goal_status"("p_goal_id" "uuid", "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."store_dashboard_valuation_snapshot"("p_base_currency_code" "text", "p_snapshot" "jsonb", "p_as_of" timestamp with time zone, "p_expires_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."store_dashboard_valuation_snapshot"("p_base_currency_code" "text", "p_snapshot" "jsonb", "p_as_of" timestamp with time zone, "p_expires_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."store_dashboard_valuation_snapshot"("p_base_currency_code" "text", "p_snapshot" "jsonb", "p_as_of" timestamp with time zone, "p_expires_at" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_goal"("p_goal_id" "uuid", "p_name" "text", "p_goal_type" "text", "p_custom_type_name" "text", "p_target_amount" numeric, "p_currency_code" "text", "p_target_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_goal"("p_goal_id" "uuid", "p_name" "text", "p_goal_type" "text", "p_custom_type_name" "text", "p_target_amount" numeric, "p_currency_code" "text", "p_target_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_goal"("p_goal_id" "uuid", "p_name" "text", "p_goal_type" "text", "p_custom_type_name" "text", "p_target_amount" numeric, "p_currency_code" "text", "p_target_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."validate_account_record_entry_ownership"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_account_record_entry_ownership"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."validate_investment_posting_metadata"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_investment_posting_metadata"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."validate_record_category_hierarchy"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_record_category_hierarchy"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."validate_record_category_override"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_record_category_override"() TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."account_types" TO "authenticated";
GRANT ALL ON TABLE "public"."account_types" TO "service_role";



GRANT ALL ON TABLE "public"."asset_identifiers" TO "service_role";
GRANT SELECT ON TABLE "public"."asset_identifiers" TO "authenticated";



GRANT ALL ON TABLE "public"."asset_types" TO "service_role";
GRANT SELECT ON TABLE "public"."asset_types" TO "authenticated";



GRANT ALL ON TABLE "public"."currencies" TO "authenticated";
GRANT ALL ON TABLE "public"."currencies" TO "service_role";



GRANT ALL ON TABLE "public"."dashboard_valuation_snapshots" TO "service_role";
GRANT SELECT ON TABLE "public"."dashboard_valuation_snapshots" TO "authenticated";



GRANT ALL ON TABLE "public"."exchange_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."exchange_rates" TO "service_role";



GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."goal_progress_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."goal_progress_entries" TO "service_role";



GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."goals" TO "authenticated";
GRANT ALL ON TABLE "public"."goals" TO "service_role";



GRANT ALL ON TABLE "public"."holdings" TO "service_role";
GRANT SELECT ON TABLE "public"."holdings" TO "authenticated";



GRANT ALL ON TABLE "public"."metal_purchase_lifecycle_events" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."record_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."record_categories" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."record_category_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."record_category_overrides" TO "service_role";



GRANT ALL ON TABLE "public"."transaction_entries" TO "service_role";
GRANT SELECT ON TABLE "public"."transaction_entries" TO "authenticated";



GRANT ALL ON TABLE "public"."transaction_types" TO "service_role";
GRANT SELECT ON TABLE "public"."transaction_types" TO "authenticated";



GRANT ALL ON TABLE "public"."user_data_export_rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."wealth_allocation_target_preferences" TO "service_role";
GRANT SELECT ON TABLE "public"."wealth_allocation_target_preferences" TO "authenticated";



GRANT ALL ON TABLE "public"."wealth_allocation_targets" TO "service_role";
GRANT SELECT ON TABLE "public"."wealth_allocation_targets" TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


-- Cross-schema integration intentionally excluded from the public-only dump.
-- Supabase owns auth.users; Tharwati owns only this trigger and its public
-- handler function (defined above).
CREATE OR REPLACE TRIGGER "on_auth_user_created"
  AFTER INSERT ON "auth"."users"
  FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();
