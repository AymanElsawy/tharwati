-- Immutable Gold/Silver purchase reversals and corrections. Historical
-- purchase rows are never updated or deleted; lifecycle events determine the
-- effective purchase set used for holdings and normal purchase history.

create table public.metal_purchase_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  affected_purchase_id uuid not null references public.metal_purchases (id) on delete restrict,
  action text not null check (action in ('reversal', 'correction')),
  replacement_purchase_id uuid references public.metal_purchases (id) on delete restrict,
  funding_reversal_transaction_id uuid references public.financial_transactions (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint metal_purchase_lifecycle_events_one_per_purchase unique (affected_purchase_id),
  constraint metal_purchase_lifecycle_events_replacement_check check (
    (action = 'correction' and replacement_purchase_id is not null)
    or (action = 'reversal' and replacement_purchase_id is null)
  ),
  constraint metal_purchase_lifecycle_events_replacement_not_self_check check (
    replacement_purchase_id is null or replacement_purchase_id <> affected_purchase_id
  )
);

create index metal_purchase_lifecycle_events_user_created_idx
  on public.metal_purchase_lifecycle_events (user_id, created_at desc);

create index metal_purchase_lifecycle_events_replacement_idx
  on public.metal_purchase_lifecycle_events (replacement_purchase_id)
  where replacement_purchase_id is not null;

alter table public.metal_purchase_lifecycle_events enable row level security;

create policy "metal_purchase_lifecycle_events_select_own"
  on public.metal_purchase_lifecycle_events
  for select to authenticated
  using (auth.uid() = user_id);

-- Lifecycle events are written only by the security-definer RPCs below. Do
-- not grant table access to client roles: ordinary history intentionally
-- exposes only effective purchases.
revoke all on table public.metal_purchase_lifecycle_events from public, anon, authenticated;

insert into public.transaction_types (code, name, is_active)
values ('investment_purchase_reversal', 'Investment purchase reversal', true)
on conflict (code) do update
set name = excluded.name, is_active = true;

alter table public.transaction_entries
  drop constraint if exists transaction_entries_accountless_external_flow_check;

alter table public.transaction_entries
  add constraint transaction_entries_accountless_external_flow_check check (
    account_id is not null
    or (
      memo in (
        'owner_contribution',
        'owner_draw',
        'metal_purchase_funding',
        'metal_purchase_funding_reversal'
      )
      and asset_id is null
      and quantity_delta is null
      and unit_price is null
      and purity is null
    )
  );

create function public.recalculate_metal_purchase_account_internal(
  p_user_id uuid,
  p_account_id uuid
)
returns public.financial_accounts
language plpgsql
security definer
set search_path = ''
as $$
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

create function public.create_metal_purchase_internal(
  p_user_id uuid,
  p_account_id uuid,
  p_purity text,
  p_occurred_at timestamptz,
  p_quantity_grams numeric,
  p_cost_per_unit numeric,
  p_funding_mode text,
  p_funding_account_id uuid,
  p_fees numeric,
  p_notes text,
  p_corrects_funding_transaction_id uuid default null
)
returns public.metal_purchases
language plpgsql
security definer
set search_path = ''
as $$
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

create function public.reverse_metal_purchase_funding_internal(
  p_user_id uuid,
  p_purchase public.metal_purchases
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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

drop function if exists public.add_metal_purchase(
  uuid, text, timestamptz, numeric, numeric, text, uuid, numeric, text
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

create function public.reverse_metal_purchase(
  p_purchase_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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

create function public.correct_metal_purchase(
  p_purchase_id uuid,
  p_purity text,
  p_occurred_at timestamptz,
  p_quantity_grams numeric,
  p_cost_per_unit numeric,
  p_funding_mode text,
  p_funding_account_id uuid,
  p_fees numeric,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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

create function public.get_effective_metal_purchases(
  p_account_ids uuid[] default null
)
returns setof public.metal_purchases
language sql
security definer
set search_path = ''
as $$
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

revoke all on function public.recalculate_metal_purchase_account_internal(uuid, uuid) from public, anon, authenticated;
revoke all on function public.create_metal_purchase_internal(uuid, uuid, text, timestamptz, numeric, numeric, text, uuid, numeric, text, uuid) from public, anon, authenticated;
revoke all on function public.reverse_metal_purchase_funding_internal(uuid, public.metal_purchases) from public, anon, authenticated;
revoke all on function public.add_metal_purchase(uuid, text, timestamptz, numeric, numeric, text, uuid, numeric, text) from public, anon, authenticated;
revoke all on function public.reverse_metal_purchase(uuid) from public, anon;
revoke all on function public.correct_metal_purchase(uuid, text, timestamptz, numeric, numeric, text, uuid, numeric, text) from public, anon;
revoke all on function public.get_effective_metal_purchases(uuid[]) from public, anon;

grant execute on function public.add_metal_purchase(uuid, text, timestamptz, numeric, numeric, text, uuid, numeric, text) to authenticated;
grant execute on function public.reverse_metal_purchase(uuid) to authenticated;
grant execute on function public.correct_metal_purchase(uuid, text, timestamptz, numeric, numeric, text, uuid, numeric, text) to authenticated;
grant execute on function public.get_effective_metal_purchases(uuid[]) to authenticated;

comment on table public.metal_purchase_lifecycle_events is
  'Append-only audit events that make an original metal purchase ineffective after immutable reversal or correction.';
comment on function public.reverse_metal_purchase(uuid) is
  'Atomically records an immutable metal-purchase reversal, reverses linked funding when present, and recomputes derived metal account fields.';
comment on function public.correct_metal_purchase(uuid, text, timestamptz, numeric, numeric, text, uuid, numeric, text) is
  'Atomically records an immutable correction, reverses prior linked funding, creates the replacement purchase, and recomputes derived metal account fields.';
