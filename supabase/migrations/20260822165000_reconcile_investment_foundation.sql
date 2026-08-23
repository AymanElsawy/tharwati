-- Reintroduce the investment foundation against the August accounts-only
-- baseline. This is intentionally a clean forward contract, not a replay of
-- the previous project's July migration chain or Buy funding behavior.

create table public.asset_types (
  code text primary key,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint asset_types_name_not_blank_check check (btrim(name) <> '')
);

insert into public.asset_types (code, name) values
  ('stock', 'Stock'),
  ('etf', 'ETF'),
  ('mutual_fund', 'Mutual Fund'),
  ('bond', 'Bond'),
  ('cryptocurrency', 'Cryptocurrency'),
  ('commodity', 'Commodity'),
  ('real_estate', 'Real Estate'),
  ('business', 'Business'),
  ('cash_equivalent', 'Cash Equivalent'),
  ('other', 'Other')
on conflict (code) do update
set name = excluded.name, is_active = true;

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  asset_type_code text not null references public.asset_types (code),
  symbol text,
  name text not null,
  currency_code text not null,
  exchange text,
  is_custom boolean not null default true,
  is_active boolean not null default true,
  canonical_quantity_unit text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assets_name_not_blank_check check (btrim(name) <> ''),
  constraint assets_currency_code_check
    check (currency_code in ('USD', 'SAR', 'EGP', 'EUR', 'GBP')),
  constraint assets_scope_consistency_check check (
    (user_id is null and not is_custom)
    or (user_id is not null and is_custom)
  ),
  constraint assets_canonical_quantity_unit_allowed_check check (
    canonical_quantity_unit in (
      'shares', 'grams', 'kilograms', 'troy_ounces', 'coins', 'property',
      'ownership_units', 'currency_amount', 'units'
    )
  )
);

create unique index assets_global_exchange_symbol_key
  on public.assets (lower(coalesce(exchange, '')), lower(btrim(symbol)))
  where user_id is null and symbol is not null;
create unique index assets_custom_user_exchange_symbol_key
  on public.assets (user_id, lower(coalesce(exchange, '')), lower(btrim(symbol)))
  where user_id is not null and symbol is not null;
create index assets_visible_active_name_idx
  on public.assets (is_active, name);

create function public.prepare_asset_canonical_quantity_unit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

create trigger assets_10_prepare_canonical_quantity_unit
before insert or update of asset_type_code, symbol, canonical_quantity_unit
on public.assets
for each row execute function public.prepare_asset_canonical_quantity_unit();

create trigger assets_set_updated_at
before update on public.assets
for each row execute function public.set_updated_at();

create table public.asset_identifiers (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  scheme text not null,
  namespace text not null,
  value text not null,
  normalized_value text not null,
  provider text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint asset_identifiers_scheme_allowed_check check (
    scheme in (
      'isin', 'ticker', 'crypto_native', 'crypto_contract', 'commodity',
      'precious_metal', 'custom_real_estate', 'custom_business', 'provider'
    )
  ),
  constraint asset_identifiers_namespace_not_blank_check check (btrim(namespace) <> ''),
  constraint asset_identifiers_value_not_blank_check check (btrim(value) <> ''),
  constraint asset_identifiers_normalized_value_not_blank_check check (btrim(normalized_value) <> '')
);

create unique index asset_identifiers_global_identity_key
  on public.asset_identifiers (scheme, lower(btrim(namespace)), normalized_value)
  where user_id is null;
create unique index asset_identifiers_custom_identity_key
  on public.asset_identifiers (user_id, scheme, lower(btrim(namespace)), normalized_value)
  where user_id is not null;
create unique index asset_identifiers_one_primary_per_asset_key
  on public.asset_identifiers (asset_id)
  where is_primary;
create index asset_identifiers_asset_id_idx
  on public.asset_identifiers (asset_id);

create function public.prepare_asset_identifier()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

create trigger asset_identifiers_prepare
before insert or update of asset_id, scheme, namespace, value
on public.asset_identifiers
for each row execute function public.prepare_asset_identifier();

create trigger asset_identifiers_set_updated_at
before update on public.asset_identifiers
for each row execute function public.set_updated_at();

alter table public.transaction_entries
  add column cost_basis_delta numeric(30, 10),
  add column account_cost_basis_delta numeric(30, 10),
  add column account_fx_rate numeric(30, 12),
  add column account_fx_effective_at timestamptz,
  add column account_fx_source text,
  add column input_quantity numeric(30, 10),
  add column input_quantity_unit text,
  add column quantity_conversion_factor numeric(30, 12),
  add constraint transaction_entries_asset_id_fkey
    foreign key (asset_id) references public.assets (id) on delete restrict,
  add constraint transaction_entries_asset_requires_account_effect_check check (
    asset_id is null
    or (account_id is not null and (quantity_delta is not null or cost_basis_delta is not null))
  ),
  add constraint transaction_entries_input_quantity_non_zero_check
    check (input_quantity is null or input_quantity <> 0),
  add constraint transaction_entries_input_quantity_unit_allowed_check check (
    input_quantity_unit is null
    or input_quantity_unit in (
      'shares', 'grams', 'kilograms', 'troy_ounces', 'coins', 'property',
      'ownership_units', 'currency_amount', 'units'
    )
  ),
  add constraint transaction_entries_quantity_conversion_factor_positive_check
    check (quantity_conversion_factor is null or quantity_conversion_factor > 0),
  add constraint transaction_entries_account_fx_rate_positive_check
    check (account_fx_rate is null or account_fx_rate > 0);

create index transaction_entries_asset_projection_idx
  on public.transaction_entries (user_id, account_id, asset_id, transaction_id)
  where asset_id is not null;

create function public.quantity_conversion_factor(
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

create function public.prepare_investment_entry_metadata()
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
  v_account_type text;
  v_asset_owner uuid;
  v_canonical_unit text;
begin
  if new.asset_id is null then
    return new;
  end if;

  select status, occurred_at, transaction_currency_code
  into v_status, v_occurred_at, v_transaction_currency
  from public.financial_transactions
  where id = new.transaction_id and user_id = new.user_id;
  if not found then
    raise exception 'asset entry does not belong to its transaction owner' using errcode = '23514';
  end if;
  if v_status <> 'draft' then return new; end if;

  select currency_code, account_type_code
  into v_account_currency, v_account_type
  from public.financial_accounts
  where id = new.account_id and user_id = new.user_id;
  if not found or v_account_type <> 'brokerage' then
    raise exception 'asset entries require an owned Brokerage account' using errcode = '23514';
  end if;

  select user_id, canonical_quantity_unit
  into v_asset_owner, v_canonical_unit
  from public.assets
  where id = new.asset_id and is_active;
  if not found or (v_asset_owner is not null and v_asset_owner <> new.user_id) then
    raise exception 'asset entry references an unavailable asset' using errcode = '23514';
  end if;

  if new.quantity_delta is not null and new.quantity_delta <> 0 then
    new.input_quantity := coalesce(new.input_quantity, new.quantity_delta);
    new.input_quantity_unit := coalesce(new.input_quantity_unit, v_canonical_unit);
    new.quantity_conversion_factor := public.quantity_conversion_factor(
      new.input_quantity_unit, v_canonical_unit
    );
    new.quantity_delta := new.input_quantity * new.quantity_conversion_factor;
  else
    new.input_quantity := null;
    new.input_quantity_unit := null;
    new.quantity_conversion_factor := null;
  end if;

  if new.cost_basis_delta is null then
    raise exception 'asset entries require a signed cost basis effect' using errcode = '23514';
  end if;

  if v_transaction_currency = v_account_currency then
    new.account_cost_basis_delta := new.cost_basis_delta;
    new.account_fx_rate := 1::numeric;
    new.account_fx_effective_at := v_occurred_at;
    new.account_fx_source := 'identity';
  else
    if new.account_fx_rate is null or new.account_fx_rate <= 0
      or new.account_fx_effective_at is null
      or nullif(btrim(new.account_fx_source), '') is null then
      raise exception 'cross-currency asset entries require immutable historical FX metadata'
        using errcode = '22023';
    end if;
    if new.account_amount <> pg_catalog.round(
      new.transaction_amount * new.account_fx_rate,
      10
    ) then
      raise exception 'account amount does not match the supplied historical FX rate'
        using errcode = '23514';
    end if;
    new.account_cost_basis_delta := pg_catalog.round(
      new.cost_basis_delta * new.account_fx_rate,
      10
    );
    new.account_fx_source := btrim(new.account_fx_source);
  end if;
  return new;
end;
$$;

create trigger transaction_entries_20_prepare_investment_metadata
before insert or update on public.transaction_entries
for each row execute function public.prepare_investment_entry_metadata();

create function public.validate_investment_posting_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

create trigger financial_transactions_25_validate_investment_metadata
before update of status on public.financial_transactions
for each row execute function public.validate_investment_posting_metadata();

create table public.holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.financial_accounts (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete restrict,
  quantity numeric(30, 10) not null default 0,
  average_cost numeric(30, 10),
  total_cost_basis numeric(30, 10) not null default 0,
  cost_currency_code text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint holdings_quantity_non_negative_check check (quantity >= 0),
  constraint holdings_total_cost_basis_non_negative_check check (total_cost_basis >= 0),
  constraint holdings_average_cost_non_negative_check check (average_cost is null or average_cost >= 0),
  constraint holdings_account_asset_key unique (account_id, asset_id)
);

create index holdings_user_account_idx on public.holdings (user_id, account_id);
create index holdings_asset_idx on public.holdings (asset_id);

create trigger holdings_set_updated_at
before update on public.holdings
for each row execute function public.set_updated_at();

create function public.rebuild_holding_projection(
  p_user_id uuid,
  p_account_id uuid default null,
  p_asset_id uuid default null
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

create or replace function public.post_transaction(transaction_id uuid)
returns public.financial_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_transaction public.financial_transactions%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select * into v_transaction
  from public.financial_transactions
  where id = post_transaction.transaction_id
    and user_id = v_user_id and status = 'draft'
  for update;
  if not found then
    raise exception 'owned draft transaction does not exist' using errcode = 'P0002';
  end if;

  perform public.assert_account_record_transaction_balanced(v_transaction.id);
  update public.financial_transactions
  set status = 'posted'
  where id = v_transaction.id
  returning * into v_transaction;

  if exists (
    select 1 from public.transaction_entries
    where transaction_id = v_transaction.id and asset_id is not null
  ) then
    perform public.rebuild_holding_projection(v_user_id);
  end if;
  return v_transaction;
end;
$$;

insert into public.transaction_types (code, name, is_active) values
  ('opening_position', 'Opening position', true),
  ('opening_position_reversal', 'Opening position reversal', true),
  ('buy', 'Buy', true),
  ('sell', 'Sell', true),
  ('dividend', 'Dividend', true),
  ('adjustment', 'Adjustment', true)
on conflict (code) do update set name = excluded.name, is_active = true;

alter table public.asset_types enable row level security;
alter table public.assets enable row level security;
alter table public.asset_identifiers enable row level security;
alter table public.holdings enable row level security;

create policy asset_types_select_active on public.asset_types
  for select to authenticated using (is_active);
create policy assets_select_visible on public.assets
  for select to authenticated using (user_id is null or user_id = auth.uid());
create policy assets_insert_custom on public.assets
  for insert to authenticated with check (user_id = auth.uid() and is_custom);
create policy assets_update_custom on public.assets
  for update to authenticated using (user_id = auth.uid() and is_custom)
  with check (user_id = auth.uid() and is_custom);
create policy assets_delete_custom on public.assets
  for delete to authenticated using (user_id = auth.uid() and is_custom);
create policy asset_identifiers_select_visible on public.asset_identifiers
  for select to authenticated using (user_id is null or user_id = auth.uid());
create policy holdings_select_own on public.holdings
  for select to authenticated using (user_id = auth.uid());

revoke all on table public.asset_types from public, anon, authenticated;
revoke all on table public.assets from public, anon, authenticated;
revoke all on table public.asset_identifiers from public, anon, authenticated;
revoke all on table public.holdings from public, anon, authenticated;
grant select on public.asset_types to authenticated;
grant select, insert, update, delete on public.assets to authenticated;
grant select on public.asset_identifiers to authenticated;
grant select on public.holdings to authenticated;

revoke all on function public.prepare_asset_canonical_quantity_unit() from public, anon, authenticated;
revoke all on function public.prepare_asset_identifier() from public, anon, authenticated;
revoke all on function public.quantity_conversion_factor(text, text) from public, anon, authenticated;
revoke all on function public.prepare_investment_entry_metadata() from public, anon, authenticated;
revoke all on function public.validate_investment_posting_metadata() from public, anon, authenticated;
revoke all on function public.rebuild_holding_projection(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.post_transaction(uuid) from public, anon, authenticated;
grant execute on function public.post_transaction(uuid) to authenticated;
