-- Reconciles fresh databases with the deployed table-backed Gold/Silver
-- purchase implementation. Migration 20260818120000 was changed after deployment.

create table if not exists public.metal_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.financial_accounts (id) on delete cascade,
  purity text not null,
  purchased_at date not null,
  quantity_grams numeric(20, 3) not null,
  cost_per_unit numeric(20, 2) not null,
  fees numeric(20, 2) not null default 0,
  funding_mode text not null,
  funding_account_id uuid references public.financial_accounts (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.metal_purchases
  add column if not exists fees numeric(20, 2) not null default 0,
  add column if not exists funding_mode text,
  add column if not exists funding_account_id uuid references public.financial_accounts (id) on delete set null,
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.metal_purchases'::regclass
      and conname = 'metal_purchases_quantity_grams_check'
  ) then
    alter table public.metal_purchases
      add constraint metal_purchases_quantity_grams_check check (quantity_grams > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.metal_purchases'::regclass
      and conname = 'metal_purchases_cost_per_unit_check'
  ) then
    alter table public.metal_purchases
      add constraint metal_purchases_cost_per_unit_check check (cost_per_unit > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.metal_purchases'::regclass
      and conname = 'metal_purchases_fees_check'
  ) then
    alter table public.metal_purchases
      add constraint metal_purchases_fees_check check (fees >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.metal_purchases'::regclass
      and conname = 'metal_purchases_funding_mode_check'
  ) then
    alter table public.metal_purchases
      add constraint metal_purchases_funding_mode_check check (
        funding_mode in ('external', 'cash_account')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.metal_purchases'::regclass
      and conname = 'metal_purchases_funding_account_check'
  ) then
    alter table public.metal_purchases
      add constraint metal_purchases_funding_account_check check (
        (funding_mode = 'cash_account' and funding_account_id is not null)
        or (funding_mode = 'external' and funding_account_id is null)
      );
  end if;
end;
$$;

create index if not exists metal_purchases_account_id_idx
  on public.metal_purchases (account_id, purchased_at desc);

alter table public.metal_purchases enable row level security;

drop policy if exists "metal_purchases_select_own" on public.metal_purchases;
create policy "metal_purchases_select_own"
  on public.metal_purchases
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "metal_purchases_insert_own" on public.metal_purchases;
create policy "metal_purchases_insert_own"
  on public.metal_purchases
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

grant select, insert on public.metal_purchases to authenticated;

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
returns public.financial_accounts
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_account public.financial_accounts%rowtype;
  v_funding_account public.financial_accounts%rowtype;
  v_purity text := lower(pg_catalog.btrim(p_purity));
  v_fee_amount numeric := coalesce(p_fees, 0::numeric);
  v_total numeric;
  v_payment_total numeric;
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

    if v_funding_account.opening_balance < v_payment_total then
      raise exception 'insufficient funding account balance' using errcode = 'P0002';
    end if;

    update public.financial_accounts
    set opening_balance = opening_balance - v_payment_total
    where id = v_funding_account.id;
  elsif p_funding_mode <> 'external' then
    raise exception 'funding mode must be external or cash_account' using errcode = '22023';
  else
    p_funding_account_id := null;
  end if;

  v_new_balance := coalesce(v_account.balance_grams, 0::numeric) + p_quantity_grams;
  v_new_cost_per_unit := (
    coalesce(v_account.balance_grams, 0::numeric) * coalesce(v_account.cost_per_unit, 0::numeric)
    + v_total
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
    cost_per_unit, fees, funding_mode, funding_account_id
  ) values (
    v_user_id, v_account.id, v_purity, p_occurred_at::date, p_quantity_grams,
    p_cost_per_unit, v_fee_amount, p_funding_mode, p_funding_account_id
  );

  return v_account;
end;
$$;

revoke all on function public.add_metal_purchase(
  uuid, text, timestamptz, numeric, numeric, text, uuid, numeric
) from public, anon, authenticated;

grant execute on function public.add_metal_purchase(
  uuid, text, timestamptz, numeric, numeric, text, uuid, numeric
) to authenticated;
