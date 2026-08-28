alter table public.transaction_entries
  add column account_cost_basis_delta numeric(30, 10),
  add column account_fx_rate numeric(30, 12),
  add column account_fx_effective_at timestamptz,
  add column account_fx_source text,
  add column input_quantity numeric(30, 10),
  add column input_quantity_unit text,
  add column quantity_conversion_factor numeric(30, 12);

alter table public.holdings
  add column total_cost_basis numeric(30, 10)
    constraint holdings_total_cost_basis_not_null not null
    default 0;

alter table public.assets
  add column canonical_quantity_unit text;

update public.assets
set canonical_quantity_unit = case
  when asset_type_code in ('stock', 'etf', 'mutual_fund', 'bond')
    then 'shares'
  when asset_type_code = 'cryptocurrency' then 'coins'
  when asset_type_code = 'real_estate' then 'property'
  when asset_type_code = 'business' then 'ownership_units'
  when asset_type_code = 'cash_equivalent' then 'currency_amount'
  when asset_type_code = 'commodity'
    and symbol in ('XAU', 'XAG') then 'troy_ounces'
  else 'units'
end;

alter table public.assets
  alter column canonical_quantity_unit set not null,
  add constraint assets_canonical_quantity_unit_allowed_check
  check (
    canonical_quantity_unit in (
      'shares',
      'grams',
      'kilograms',
      'troy_ounces',
      'coins',
      'property',
      'ownership_units',
      'currency_amount',
      'units'
    )
  );

alter table public.transaction_entries
  add constraint transaction_entries_input_quantity_non_zero_check
    check (input_quantity is null or input_quantity <> 0),
  add constraint transaction_entries_input_quantity_unit_allowed_check
    check (
      input_quantity_unit is null
      or input_quantity_unit in (
        'shares',
        'grams',
        'kilograms',
        'troy_ounces',
        'coins',
        'property',
        'ownership_units',
        'currency_amount',
        'units'
      )
    ),
  add constraint transaction_entries_quantity_conversion_factor_positive_check
    check (
      quantity_conversion_factor is null
      or quantity_conversion_factor > 0
    ),
  add constraint transaction_entries_account_fx_rate_positive_check
    check (account_fx_rate is null or account_fx_rate > 0);

comment on column public.transaction_entries.account_cost_basis_delta is
  'Signed historical holding cost-basis effect in account currency. New cost effects require this value; immutable legacy entries remain null and use the documented projection fallback.';

comment on column public.transaction_entries.account_fx_rate is
  'Historical rate for one unit of transaction currency expressed in account currency. Immutable legacy values remain null.';

comment on column public.transaction_entries.input_quantity is
  'Original signed quantity entered for a new ledger effect. Immutable legacy entries remain null.';

comment on column public.transaction_entries.quantity_conversion_factor is
  'Positive factor converting input_quantity to canonical quantity_delta. Immutable legacy entries remain null.';

comment on column public.holdings.total_cost_basis is
  'Read-only account-currency cache rebuilt from posted ledger cost effects, including applicable fees. It is never calculated from quantity times average_cost.';

create or replace function public.prepare_asset_quantity_unit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.canonical_quantity_unit is null then
    new.canonical_quantity_unit := case
      when new.asset_type_code in (
        'stock', 'etf', 'mutual_fund', 'bond'
      ) then 'shares'
      when new.asset_type_code = 'cryptocurrency' then 'coins'
      when new.asset_type_code = 'real_estate' then 'property'
      when new.asset_type_code = 'business' then 'ownership_units'
      when new.asset_type_code = 'cash_equivalent'
        then 'currency_amount'
      when new.asset_type_code = 'commodity'
        and new.symbol in ('XAU', 'XAG') then 'troy_ounces'
      else 'units'
    end;
  end if;
  return new;
end;
$$;

revoke all on function public.prepare_asset_quantity_unit()
  from public, anon, authenticated;

create trigger assets_prepare_quantity_unit
before insert or update of
  asset_type_code,
  symbol,
  canonical_quantity_unit
on public.assets
for each row
execute function public.prepare_asset_quantity_unit();

create or replace function public.quantity_conversion_factor(
  p_input_unit text,
  p_canonical_unit text
)
returns numeric
language plpgsql
immutable
security definer
set search_path = ''
as $$
begin
  if p_input_unit = p_canonical_unit then
    return 1::numeric;
  elsif p_input_unit = 'kilograms' and p_canonical_unit = 'grams' then
    return 1000::numeric;
  elsif p_input_unit = 'grams' and p_canonical_unit = 'kilograms' then
    return 0.001::numeric;
  elsif p_input_unit = 'troy_ounces' and p_canonical_unit = 'grams' then
    return 31.1034768::numeric;
  elsif p_input_unit = 'grams' and p_canonical_unit = 'troy_ounces' then
    return 1::numeric / 31.1034768::numeric;
  elsif p_input_unit = 'kilograms'
    and p_canonical_unit = 'troy_ounces' then
    return 1000::numeric / 31.1034768::numeric;
  elsif p_input_unit = 'troy_ounces'
    and p_canonical_unit = 'kilograms' then
    return 31.1034768::numeric / 1000::numeric;
  end if;

  raise exception
    'quantity unit % is not compatible with canonical unit %',
    p_input_unit,
    p_canonical_unit
    using errcode = '22023';
end;
$$;

revoke all on function public.quantity_conversion_factor(text, text)
  from public, anon, authenticated;

create or replace function public.prepare_future_entry_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_occurred_at timestamptz;
  v_transaction_currency text;
  v_account_currency text;
  v_canonical_unit text;
  v_rate numeric;
  v_rate_effective_at timestamptz;
  v_rate_source text;
begin
  select
    status,
    occurred_at,
    transaction_currency_code
  into
    v_status,
    v_occurred_at,
    v_transaction_currency
  from public.financial_transactions
  where id = new.transaction_id;

  if v_status <> 'draft' then
    return new;
  end if;

  select currency_code
  into v_account_currency
  from public.financial_accounts
  where id = new.account_id;

  if new.quantity_delta is not null and new.quantity_delta <> 0 then
    select canonical_quantity_unit
    into v_canonical_unit
    from public.assets
    where id = new.asset_id;

    -- The existing Add Investment API accepts quantities only in the
    -- displayed canonical unit. Future unit-aware callers may provide the
    -- original unit explicitly.
    new.input_quantity := coalesce(
      new.input_quantity,
      new.quantity_delta
    );
    new.input_quantity_unit := coalesce(
      new.input_quantity_unit,
      v_canonical_unit
    );
    new.quantity_conversion_factor :=
      public.quantity_conversion_factor(
        new.input_quantity_unit,
        v_canonical_unit
      );
    new.quantity_delta :=
      new.input_quantity * new.quantity_conversion_factor;
  else
    new.input_quantity := null;
    new.input_quantity_unit := null;
    new.quantity_conversion_factor := null;
  end if;

  if new.cost_basis_delta is null or new.asset_id is null then
    new.account_cost_basis_delta := null;
    new.account_fx_rate := null;
    new.account_fx_effective_at := null;
    new.account_fx_source := null;
    return new;
  end if;

  if v_transaction_currency = v_account_currency then
    new.account_cost_basis_delta := new.cost_basis_delta;
    new.account_fx_rate := 1::numeric;
    new.account_fx_effective_at := v_occurred_at;
    new.account_fx_source := 'identity';
    return new;
  end if;

  select
    candidates.rate,
    candidates.effective_at,
    candidates.source
  into
    v_rate,
    v_rate_effective_at,
    v_rate_source
  from (
    select
      exchange_rates.rate,
      exchange_rates.effective_at,
      exchange_rates.source,
      1 as precedence,
      exchange_rates.id
    from public.exchange_rates
    where exchange_rates.base_currency_code =
        v_transaction_currency
      and exchange_rates.quote_currency_code =
        v_account_currency
      and exchange_rates.effective_at <= v_occurred_at
      and exchange_rates.rate > 0
    union all
    select
      1::numeric / exchange_rates.rate,
      exchange_rates.effective_at,
      exchange_rates.source,
      2,
      exchange_rates.id
    from public.exchange_rates
    where exchange_rates.base_currency_code =
        v_account_currency
      and exchange_rates.quote_currency_code =
        v_transaction_currency
      and exchange_rates.effective_at <= v_occurred_at
      and exchange_rates.rate > 0
  ) as candidates
  order by
    candidates.effective_at desc,
    candidates.precedence asc,
    candidates.id desc
  limit 1;

  if v_rate is null then
    raise exception
      'missing historical exchange rate for % to % at %',
      v_transaction_currency,
      v_account_currency,
      v_occurred_at
      using errcode = 'P0002';
  end if;

  if new.account_amount
    <> new.transaction_amount * v_rate
  then
    raise exception
      'account amount does not match the selected historical rate'
      using errcode = '23514';
  end if;

  new.account_cost_basis_delta :=
    new.cost_basis_delta * v_rate;
  new.account_fx_rate := v_rate;
  new.account_fx_effective_at := v_rate_effective_at;
  new.account_fx_source := coalesce(v_rate_source, 'exchange_rates');
  return new;
end;
$$;

comment on function public.prepare_future_entry_metadata() is
  'Completes canonical quantity and historical account-currency cost metadata for future draft entries only. Posted legacy entries are returned unchanged. Cross-currency rates use the latest effective direct rate, then inverse only at the same timestamp, with id as a deterministic tie-breaker; multi-hop conversion is not used.';

revoke all on function public.prepare_future_entry_metadata()
  from public, anon, authenticated;

create trigger transaction_entries_20_prepare_future_metadata
before insert or update on public.transaction_entries
for each row
execute function public.prepare_future_entry_metadata();

create or replace function public.validate_future_posting_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'posted' or old.status = 'posted' then
    return new;
  end if;

  if exists (
    select 1
    from public.transaction_entries as entries
    join public.assets as assets on assets.id = entries.asset_id
    join public.financial_accounts as accounts
      on accounts.id = entries.account_id
    where entries.transaction_id = new.id
      and (
        (
          entries.quantity_delta is not null
          and entries.quantity_delta <> 0
          and (
            entries.input_quantity is null
            or entries.input_quantity_unit is null
            or entries.quantity_conversion_factor is null
            or entries.quantity_conversion_factor <= 0
            or entries.quantity_delta <>
              entries.input_quantity
              * entries.quantity_conversion_factor
            or entries.quantity_conversion_factor <>
              public.quantity_conversion_factor(
                entries.input_quantity_unit,
                assets.canonical_quantity_unit
              )
          )
        )
        or (
          entries.cost_basis_delta is not null
          and entries.asset_id is not null
          and (
            entries.account_cost_basis_delta is null
            or entries.account_fx_rate is null
            or entries.account_fx_rate <= 0
            or (
              new.transaction_currency_code <> accounts.currency_code
              and (
                entries.account_fx_effective_at is null
                or entries.account_fx_source is null
              )
            )
          )
        )
      )
  ) then
    raise exception
      'transaction % has incomplete holding or historical FX metadata',
      new.id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

comment on function public.validate_future_posting_metadata() is
  'Rejects future draft-to-posted transitions unless quantity and account-currency cost effects are complete. Already-posted immutable legacy entries are never revalidated or changed.';

revoke all on function public.validate_future_posting_metadata()
  from public, anon, authenticated;

create trigger financial_transactions_25_validate_future_metadata
before update of status on public.financial_transactions
for each row
execute function public.validate_future_posting_metadata();

create or replace function public.rebuild_holding_projection(
  p_user_id uuid,
  p_account_id uuid default null,
  p_asset_id uuid default null,
  p_pending_transaction_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_effect record;
begin
  if p_user_id is null then
    raise exception 'holding rebuild user is required'
      using errcode = '22023';
  end if;

  if (p_account_id is null) <> (p_asset_id is null) then
    raise exception
      'holding rebuild account and asset scopes must be supplied together'
      using errcode = '22023';
  end if;

  for v_effect in
    select distinct entries.account_id, entries.asset_id
    from public.transaction_entries as entries
    join public.financial_transactions as transactions
      on transactions.id = entries.transaction_id
    where entries.user_id = p_user_id
      and entries.asset_id is not null
      and (
        entries.quantity_delta is not null
        or entries.cost_basis_delta is not null
        or entries.account_cost_basis_delta is not null
      )
      and (
        transactions.status = 'posted'
        or transactions.id = p_pending_transaction_id
      )
      and (
        p_account_id is null
        or (
          entries.account_id = p_account_id
          and entries.asset_id = p_asset_id
        )
      )
    order by entries.account_id, entries.asset_id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        v_effect.account_id::text || ':' || v_effect.asset_id::text,
        0
      )
    );
  end loop;

  for v_effect in
    select
      entries.account_id,
      entries.asset_id,
      coalesce(sum(entries.quantity_delta), 0::numeric) as quantity,
      coalesce(sum(
        case
          when entries.account_cost_basis_delta is not null
            then entries.account_cost_basis_delta
          when entries.cost_basis_delta is not null
            and entries.asset_id is not null
            then entries.account_amount
          else 0
        end
      ), 0::numeric) as total_cost_basis
    from public.transaction_entries as entries
    join public.financial_transactions as transactions
      on transactions.id = entries.transaction_id
    where entries.user_id = p_user_id
      and entries.asset_id is not null
      and (
        transactions.status = 'posted'
        or transactions.id = p_pending_transaction_id
      )
      and (
        p_account_id is null
        or (
          entries.account_id = p_account_id
          and entries.asset_id = p_asset_id
        )
      )
    group by entries.account_id, entries.asset_id
  loop
    if v_effect.quantity < 0 then
      raise exception
        'derived holding quantity is negative for account % and asset %',
        v_effect.account_id,
        v_effect.asset_id
        using errcode = '23514';
    end if;

    if v_effect.quantity > 0
      and v_effect.total_cost_basis < 0
    then
      raise exception
        'derived holding cost basis is negative for account % and asset %',
        v_effect.account_id,
        v_effect.asset_id
        using errcode = '23514';
    end if;
  end loop;

  insert into public.holdings (
    user_id,
    account_id,
    asset_id,
    quantity,
    average_cost,
    total_cost_basis,
    cost_currency_code
  )
  select
    entries.user_id,
    entries.account_id,
    entries.asset_id,
    sum(entries.quantity_delta),
    case
      when sum(entries.quantity_delta) > 0 then
        sum(
          case
            when entries.account_cost_basis_delta is not null
              then entries.account_cost_basis_delta
            when entries.cost_basis_delta is not null
              and entries.asset_id is not null
              then entries.account_amount
            else 0
          end
        ) / sum(entries.quantity_delta)
      else null
    end,
    case
      when sum(entries.quantity_delta) > 0 then
        sum(
          case
            when entries.account_cost_basis_delta is not null
              then entries.account_cost_basis_delta
            when entries.cost_basis_delta is not null
              and entries.asset_id is not null
              then entries.account_amount
            else 0
          end
        )
      else 0::numeric
    end,
    accounts.currency_code
  from public.transaction_entries as entries
  join public.financial_transactions as transactions
    on transactions.id = entries.transaction_id
  join public.financial_accounts as accounts
    on accounts.id = entries.account_id
  where entries.user_id = p_user_id
    and entries.asset_id is not null
    and (
      transactions.status = 'posted'
      or transactions.id = p_pending_transaction_id
    )
    and (
      p_account_id is null
      or (
        entries.account_id = p_account_id
        and entries.asset_id = p_asset_id
      )
    )
  group by
    entries.user_id,
    entries.account_id,
    entries.asset_id,
    accounts.currency_code
  on conflict (account_id, asset_id)
  do update set
    quantity = excluded.quantity,
    average_cost = excluded.average_cost,
    total_cost_basis = excluded.total_cost_basis,
    cost_currency_code = excluded.cost_currency_code;

  delete from public.holdings as holdings
  where holdings.user_id = p_user_id
    and (
      p_account_id is null
      or (
        holdings.account_id = p_account_id
        and holdings.asset_id = p_asset_id
      )
    )
    and not exists (
      select 1
      from public.transaction_entries as entries
      join public.financial_transactions as transactions
        on transactions.id = entries.transaction_id
      where entries.user_id = p_user_id
        and entries.account_id = holdings.account_id
        and entries.asset_id = holdings.asset_id
        and transactions.status = 'posted'
    );
end;
$$;

comment on function public.rebuild_holding_projection(
  uuid, uuid, uuid, uuid
) is
  'Rebuilds holdings without reading previous projection values. New rows use signed account_cost_basis_delta. Immutable legacy rows fall back exactly to account_amount only when cost_basis_delta is non-null and asset_id is present. Closed positions remain with zero quantity, zero cost, and null average cost.';

revoke all on function public.rebuild_holding_projection(
  uuid, uuid, uuid, uuid
) from public, anon, authenticated;
