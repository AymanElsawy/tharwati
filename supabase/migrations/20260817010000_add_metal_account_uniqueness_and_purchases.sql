drop index if exists public.financial_accounts_user_name_lower_key;

create unique index financial_accounts_non_metal_user_name_lower_key
  on public.financial_accounts (user_id, lower(btrim(name)))
  where account_type_code <> 'gold';

create unique index financial_accounts_user_currency_metal_type_key
  on public.financial_accounts (user_id, currency_code, metal_type)
  where account_type_code = 'gold' and metal_type is not null;

alter table public.financial_accounts
  add constraint financial_accounts_gold_metal_type_required_check check (
    account_type_code <> 'gold' or metal_type in ('gold', 'silver')
  );

alter table public.transaction_entries
  add column purity text;

alter table public.transaction_entries
  add constraint transaction_entries_metal_purchase_purity_check check (
    purity is null
    or (
      memo = 'metal_purchase'
      and purity in (
        '24k', '22k', '21k', '18k', '14k', '10k', '9k',
        '999', '958', '950', '925', '900', '835', '800', 'other'
      )
    )
  );

comment on column public.transaction_entries.purity is
  'Structured purity for a metal_purchase asset entry. Metal-specific validity is enforced by add_metal_purchase.';

create or replace function public.add_metal_purchase(
  p_account_id uuid,
  p_purity text,
  p_occurred_at timestamptz,
  p_quantity_grams numeric,
  p_cost_per_unit numeric,
  p_funding_mode text,
  p_funding_account_id uuid,
  p_fees numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_account public.financial_accounts%rowtype;
  v_funding_account public.financial_accounts%rowtype;
  v_asset public.assets%rowtype;
  v_transaction public.financial_transactions%rowtype;
  v_purity text := lower(pg_catalog.btrim(p_purity));
  v_total numeric;
  v_fee_amount numeric := coalesce(p_fees, 0::numeric);
  v_payment_total numeric;
  v_funding_rate numeric;
  v_available_funding numeric;
  v_asset_name text;
  v_asset_symbol text;
begin
  if v_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  select * into v_account
  from public.financial_accounts
  where id = p_account_id
    and user_id = v_user_id
    and account_type_code = 'gold'
    and metal_type in ('gold', 'silver')
    and is_active
  for update;

  if not found then
    raise exception 'active owned Gold/Silver account % does not exist', p_account_id
      using errcode = 'P0002';
  end if;

  if p_occurred_at is null then
    raise exception 'purchase date is required' using errcode = '22023';
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

  v_total := p_quantity_grams * p_cost_per_unit;
  v_payment_total := v_total + v_fee_amount;
  v_asset_name := initcap(v_account.metal_type) || ' ' || v_account.currency_code || ' grams';
  v_asset_symbol := case v_account.metal_type when 'gold' then 'XAU-G-' else 'XAG-G-' end
    || v_account.currency_code;

  select * into v_asset
  from public.assets
  where user_id = v_user_id
    and lower(btrim(name)) = lower(v_asset_name)
  for update;

  if not found then
    insert into public.assets (
      user_id, asset_type_code, symbol, name, currency_code,
      is_custom, is_active, canonical_quantity_unit
    ) values (
      v_user_id, 'commodity', v_asset_symbol, v_asset_name,
      v_account.currency_code, true, true, 'grams'
    )
    returning * into v_asset;
  end if;

  if p_funding_mode = 'external' then
    if p_funding_account_id is not null then
      raise exception 'external funding cannot specify a funding account'
        using errcode = '22023';
    end if;

    insert into public.financial_accounts (
      user_id, account_type_code, name, currency_code,
      opening_balance, notes, is_active
    ) values (
      v_user_id, 'other', 'External funding ' || v_account.currency_code,
      v_account.currency_code, 0::numeric,
      'system:external_investment_funding', false
    )
    on conflict (user_id, currency_code)
      where notes = 'system:external_investment_funding'
    do update set is_active = false
    returning * into v_funding_account;

    v_funding_rate := 1::numeric;
  elsif p_funding_mode = 'cash_account' then
    if p_funding_account_id is null then
      raise exception 'a funding cash account is required' using errcode = '22023';
    end if;

    select * into v_funding_account
    from public.financial_accounts
    where id = p_funding_account_id
      and user_id = v_user_id
      and is_active
      and account_type_code in ('cash', 'bank', 'deposit')
    for update;

    if not found then
      raise exception 'selected funding account is not available' using errcode = '42501';
    end if;

    if v_funding_account.currency_code = v_account.currency_code then
      v_funding_rate := 1::numeric;
    else
      select rate into v_funding_rate
      from public.resolve_historical_exchange_rate(
        v_account.currency_code,
        v_funding_account.currency_code,
        p_occurred_at
      );
      if v_funding_rate is null or v_funding_rate <= 0 then
        raise exception 'a historical funding-account exchange rate is required'
          using errcode = 'P0002';
      end if;
    end if;

    select accounts.opening_balance + coalesce(sum(
      case entries.entry_side
        when 'debit' then entries.account_amount
        else -entries.account_amount
      end
    ) filter (where transactions.status = 'posted'), 0::numeric)
    into v_available_funding
    from public.financial_accounts as accounts
    left join public.transaction_entries as entries
      on entries.account_id = accounts.id and entries.asset_id is null
    left join public.financial_transactions as transactions
      on transactions.id = entries.transaction_id
      and transactions.user_id = accounts.user_id
    where accounts.id = v_funding_account.id
    group by accounts.opening_balance;

    if v_available_funding < v_payment_total * v_funding_rate then
      raise exception 'insufficient funding account balance' using errcode = 'P0002';
    end if;
  else
    raise exception 'funding mode must be external or cash_account' using errcode = '22023';
  end if;

  insert into public.financial_transactions (
    user_id, transaction_type_code, transaction_currency_code,
    status, occurred_at, description
  ) values (
    v_user_id, 'buy', v_account.currency_code, 'draft', p_occurred_at,
    'Buy ' || initcap(v_account.metal_type)
  )
  returning * into v_transaction;

  insert into public.transaction_entries (
    transaction_id, user_id, account_id, asset_id, entry_side,
    transaction_amount, account_amount, quantity_delta,
    input_quantity, input_quantity_unit, quantity_conversion_factor,
    cost_basis_delta, account_cost_basis_delta, account_fx_rate,
    unit_price, memo, purity
  ) values (
    v_transaction.id, v_user_id, v_account.id, v_asset.id, 'debit',
    v_total, v_total, p_quantity_grams,
    p_quantity_grams, 'grams', 1,
    v_total, v_total, 1,
    p_cost_per_unit, 'metal_purchase', v_purity
  );

  if v_fee_amount > 0 then
    insert into public.transaction_entries (
      transaction_id, user_id, account_id, asset_id, entry_side,
      transaction_amount, account_amount,
      cost_basis_delta, account_cost_basis_delta, account_fx_rate,
      memo
    ) values (
      v_transaction.id, v_user_id, v_account.id, v_asset.id, 'debit',
      v_fee_amount, v_fee_amount,
      v_fee_amount, v_fee_amount, 1,
      'metal_purchase_fee'
    );
  end if;

  insert into public.transaction_entries (
    transaction_id, user_id, account_id, entry_side,
    transaction_amount, account_amount, memo
  ) values (
    v_transaction.id, v_user_id, v_funding_account.id, 'credit',
    v_payment_total, v_payment_total * v_funding_rate,
    case p_funding_mode
      when 'external' then 'owner_contribution'
      else 'metal_purchase_payment'
    end
  );

  select * into v_transaction
  from public.post_transaction(v_transaction.id);

  return pg_catalog.jsonb_build_object(
    'transaction', pg_catalog.to_jsonb(v_transaction),
    'entries', (
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(entries) order by entries.created_at)
      from public.transaction_entries as entries
      where entries.transaction_id = v_transaction.id
    )
  );
end;
$$;

revoke all on function public.add_metal_purchase(
  uuid, text, timestamptz, numeric, numeric, text, uuid, numeric
)
  from public, anon, authenticated;
grant execute on function public.add_metal_purchase(
  uuid, text, timestamptz, numeric, numeric, text, uuid, numeric
)
  to authenticated;
