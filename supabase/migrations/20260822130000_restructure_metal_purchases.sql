-- Gold/Silver purchase records are disposable test data. The deployed RPC
-- deducted funded purchases directly from opening_balance, so restore those
-- exact deductions before removing the rows and their derived metal state.
update public.financial_accounts as account
set opening_balance = account.opening_balance + restoration.total_cost_basis
from (
  select
    purchase.funding_account_id,
    sum(
      purchase.quantity_grams * purchase.cost_per_unit + coalesce(purchase.fees, 0::numeric)
    ) as total_cost_basis
  from public.metal_purchases as purchase
  where purchase.funding_mode = 'cash_account'
    and purchase.funding_account_id is not null
  group by purchase.funding_account_id
) as restoration
where account.id = restoration.funding_account_id
  and account.account_type_code in ('cash', 'bank');

with removed_purchases as (
  delete from public.metal_purchases
  returning account_id
)
update public.financial_accounts as account
set
  balance_grams = 0,
  cost_per_unit = null,
  purity = null,
  purchase_date = null
where account.account_type_code = 'gold'
  and account.id in (select distinct account_id from removed_purchases);

alter table public.metal_purchases
  add column if not exists notes text,
  add column if not exists funding_transaction_id uuid
    references public.financial_transactions (id) on delete restrict;

alter table public.metal_purchases
  alter column purchased_at type timestamptz
  using purchased_at::timestamp at time zone 'UTC';

alter table public.metal_purchases
  drop constraint if exists metal_purchases_funding_account_check;

alter table public.metal_purchases
  add constraint metal_purchases_funding_account_check check (
    (funding_mode = 'cash_account'
      and funding_account_id is not null
      and funding_transaction_id is not null)
    or (funding_mode = 'external'
      and funding_account_id is null
      and funding_transaction_id is null)
  );

alter table public.transaction_entries
  drop constraint if exists transaction_entries_accountless_external_flow_check;

alter table public.transaction_entries
  add constraint transaction_entries_accountless_external_flow_check check (
    account_id is not null
    or (
      memo in ('owner_contribution', 'owner_draw', 'metal_purchase_funding')
      and asset_id is null
      and quantity_delta is null
      and unit_price is null
      and purity is null
    )
  );

insert into public.transaction_types (code, name, is_active)
values ('investment_purchase', 'Investment purchase', true)
on conflict (code) do update
set name = excluded.name, is_active = true;

drop function if exists public.add_metal_purchase(
  uuid, text, timestamptz, numeric, numeric, text, uuid, numeric
);

create function public.add_metal_purchase(
  p_account_id uuid,
  p_purity text,
  p_occurred_at timestamptz,
  p_quantity_grams numeric,
  p_cost_per_unit numeric,
  p_funding_mode text,
  p_funding_account_id uuid,
  p_fees numeric,
  p_notes text default null
)
returns public.financial_accounts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_account public.financial_accounts%rowtype;
  v_funding_account public.financial_accounts%rowtype;
  v_funding_transaction public.financial_transactions%rowtype;
  v_purity text := lower(pg_catalog.btrim(p_purity));
  v_fee_amount numeric := coalesce(p_fees, 0::numeric);
  v_notes text := nullif(pg_catalog.btrim(p_notes), '');
  v_subtotal numeric;
  v_cost_basis numeric;
  v_available_funding numeric;
  v_new_balance numeric;
  v_new_cost_per_unit numeric;
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

  v_subtotal := p_quantity_grams * p_cost_per_unit;
  v_cost_basis := v_subtotal + v_fee_amount;

  if p_funding_mode = 'cash_account' then
    if p_funding_account_id is null then
      raise exception 'a funding cash account is required' using errcode = '22023';
    end if;

    select * into v_funding_account
    from public.financial_accounts
    where id = p_funding_account_id
      and user_id = v_user_id
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

    select v_funding_account.opening_balance + coalesce((
      select sum(
        case entry.entry_side
          when 'debit' then entry.account_amount
          else -entry.account_amount
        end
      )
      from public.transaction_entries as entry
      join public.financial_transactions as transaction
        on transaction.id = entry.transaction_id
       and transaction.user_id = v_user_id
      where entry.account_id = v_funding_account.id
        and entry.asset_id is null
        and transaction.status = 'posted'
    ), 0::numeric)
    into v_available_funding;

    if v_available_funding < v_cost_basis then
      raise exception 'insufficient funding account balance' using errcode = 'P0002';
    end if;

    insert into public.financial_transactions (
      user_id,
      transaction_type_code,
      transaction_currency_code,
      status,
      occurred_at,
      description,
      notes
    ) values (
      v_user_id,
      'investment_purchase',
      v_account.currency_code,
      'draft',
      p_occurred_at,
      initcap(v_account.metal_type) || ' purchase',
      v_notes
    )
    returning * into v_funding_transaction;

    insert into public.transaction_entries (
      transaction_id,
      user_id,
      account_id,
      entry_side,
      transaction_amount,
      account_amount,
      memo
    ) values (
      v_funding_transaction.id,
      v_user_id,
      null,
      'debit',
      v_cost_basis,
      v_cost_basis,
      'metal_purchase_funding'
    ), (
      v_funding_transaction.id,
      v_user_id,
      v_funding_account.id,
      'credit',
      v_cost_basis,
      v_cost_basis,
      'metal_purchase_funding'
    );

    select * into v_funding_transaction
    from public.post_transaction(v_funding_transaction.id);
  elsif p_funding_mode <> 'external' then
    raise exception 'funding mode must be external or cash_account' using errcode = '22023';
  else
    if p_funding_account_id is not null then
      raise exception 'external funding cannot specify a funding account' using errcode = '22023';
    end if;
    p_funding_account_id := null;
  end if;

  v_new_balance := coalesce(v_account.balance_grams, 0::numeric) + p_quantity_grams;
  v_new_cost_per_unit := (
    coalesce(v_account.balance_grams, 0::numeric) * coalesce(v_account.cost_per_unit, 0::numeric)
    + v_cost_basis
  ) / v_new_balance;

  update public.financial_accounts
  set
    balance_grams = v_new_balance,
    cost_per_unit = v_new_cost_per_unit,
    purity = v_purity,
    purchase_date = p_occurred_at::date
  where id = v_account.id
  returning * into v_account;

  insert into public.metal_purchases (
    user_id, account_id, purity, purchased_at, quantity_grams,
    cost_per_unit, fees, funding_mode, funding_account_id, funding_transaction_id, notes
  ) values (
    v_user_id, v_account.id, v_purity, p_occurred_at, p_quantity_grams,
    p_cost_per_unit, v_fee_amount, p_funding_mode, p_funding_account_id,
    case when p_funding_mode = 'cash_account' then v_funding_transaction.id else null end,
    v_notes
  );

  return v_account;
end;
$$;

revoke all on function public.add_metal_purchase(
  uuid, text, timestamptz, numeric, numeric, text, uuid, numeric, text
) from public, anon, authenticated;

grant execute on function public.add_metal_purchase(
  uuid, text, timestamptz, numeric, numeric, text, uuid, numeric, text
) to authenticated;
