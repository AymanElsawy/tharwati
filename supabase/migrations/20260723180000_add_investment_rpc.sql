alter table public.transaction_entries
add column cost_basis_delta numeric(30, 10);

alter table public.transaction_entries
drop constraint transaction_entries_quantity_delta_non_zero_check;

alter table public.transaction_entries
add constraint transaction_entries_holding_effects_require_asset_check
check (
  asset_id is not null
  or (
    quantity_delta is null
    and cost_basis_delta is null
  )
);

comment on column public.transaction_entries.quantity_delta is
  'Explicit holding quantity effect. Null means no quantity effect; zero is permitted for a separately visible entry such as a capitalized fee.';

comment on column public.transaction_entries.cost_basis_delta is
  'Explicit holding cost-basis effect in the parent transaction currency. Holdings are rebuilt from posted quantity_delta and cost_basis_delta values, never from transaction type or prior cached holding values.';

create or replace function public.normalize_asset_identifier(
  p_scheme text,
  p_namespace text,
  p_value text
)
returns text
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_scheme text := pg_catalog.lower(pg_catalog.btrim(p_scheme));
  v_namespace text := pg_catalog.lower(pg_catalog.btrim(p_namespace));
  v_value text := pg_catalog.btrim(p_value);
begin
  if v_scheme not in (
    'isin',
    'ticker',
    'crypto_native',
    'crypto_contract',
    'commodity',
    'precious_metal',
    'custom_real_estate',
    'custom_business',
    'provider'
  ) then
    raise exception
      'unsupported asset identifier scheme %',
      p_scheme
      using errcode = '22023';
  end if;

  if v_namespace = '' or v_value = '' then
    raise exception
      'asset identifier namespace and value must not be blank'
      using errcode = '22023';
  end if;

  if v_scheme = 'isin' then
    v_value := pg_catalog.upper(
      pg_catalog.regexp_replace(v_value, '[[:space:]-]', '', 'g')
    );

    if v_value !~ '^[A-Z]{2}[A-Z0-9]{9}[0-9]$' then
      raise exception
        'invalid ISIN identifier'
        using errcode = '22023';
    end if;

    return v_value;
  end if;

  if v_scheme in ('ticker', 'commodity') then
    return pg_catalog.upper(v_value);
  end if;

  if v_scheme = 'crypto_contract' then
    return pg_catalog.lower(v_value);
  end if;

  -- Native crypto, physical-metal specifications, user-scoped custom
  -- identifiers, and provider aliases are normalized case-insensitively.
  return pg_catalog.lower(
    pg_catalog.regexp_replace(v_value, '[[:space:]]+', ' ', 'g')
  );
end;
$$;

comment on function public.normalize_asset_identifier(text, text, text) is
  'Normalizes canonical asset identifiers: ISIN removes spaces/hyphens and uppercases; ticker and commodity codes uppercase; contract addresses lowercase within their chain namespace; native crypto, physical-metal specifications, user custom identifiers, and provider aliases normalize case and whitespace. Namespace is normalized separately by the write trigger.';

revoke all on function public.normalize_asset_identifier(text, text, text)
  from public;
revoke all on function public.normalize_asset_identifier(text, text, text)
  from anon;
revoke all on function public.normalize_asset_identifier(text, text, text)
  from authenticated;

create table public.asset_identifiers (
  id uuid
    constraint asset_identifiers_pkey primary key
    default gen_random_uuid(),
  asset_id uuid
    constraint asset_identifiers_asset_id_not_null not null,
  user_id uuid,
  scheme text
    constraint asset_identifiers_scheme_not_null not null,
  namespace text
    constraint asset_identifiers_namespace_not_null not null,
  value text
    constraint asset_identifiers_value_not_null not null,
  normalized_value text
    constraint asset_identifiers_normalized_value_not_null not null,
  provider text,
  is_primary boolean
    constraint asset_identifiers_is_primary_not_null not null
    default false,
  created_at timestamptz
    constraint asset_identifiers_created_at_not_null not null
    default now(),
  updated_at timestamptz
    constraint asset_identifiers_updated_at_not_null not null
    default now(),
  constraint asset_identifiers_asset_id_assets_fkey
    foreign key (asset_id)
    references public.assets (id)
    on delete cascade,
  constraint asset_identifiers_user_id_auth_users_fkey
    foreign key (user_id)
    references auth.users (id)
    on delete cascade,
  constraint asset_identifiers_scheme_allowed_check
    check (
      scheme in (
        'isin',
        'ticker',
        'crypto_native',
        'crypto_contract',
        'commodity',
        'precious_metal',
        'custom_real_estate',
        'custom_business',
        'provider'
      )
    ),
  constraint asset_identifiers_namespace_not_blank_check
    check (pg_catalog.btrim(namespace) <> ''),
  constraint asset_identifiers_value_not_blank_check
    check (pg_catalog.btrim(value) <> ''),
  constraint asset_identifiers_normalized_value_not_blank_check
    check (pg_catalog.btrim(normalized_value) <> '')
);

create unique index asset_identifiers_global_identity_key
on public.asset_identifiers (
  scheme,
  namespace,
  normalized_value
)
where user_id is null;

create unique index asset_identifiers_user_identity_key
on public.asset_identifiers (
  user_id,
  scheme,
  namespace,
  normalized_value
)
where user_id is not null;

create unique index asset_identifiers_asset_primary_key
on public.asset_identifiers (asset_id)
where is_primary;

create index asset_identifiers_asset_id_idx
on public.asset_identifiers (asset_id);

create or replace function public.prepare_asset_identifier()
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
    raise exception
      'asset % does not exist',
      new.asset_id
      using errcode = '23503';
  end if;

  new.user_id := v_asset_user_id;
  new.scheme := pg_catalog.lower(pg_catalog.btrim(new.scheme));
  new.namespace := pg_catalog.lower(pg_catalog.btrim(new.namespace));
  new.value := pg_catalog.btrim(new.value);

  if new.scheme in ('isin', 'commodity') then
    -- ISIN and canonical commodity codes are universal identifiers.
    new.namespace := 'global';
  elsif new.scheme = 'precious_metal' then
    -- Value carries the normalized metal, purity, and measurement spec.
    new.namespace := 'physical';
  elsif new.scheme in ('custom_real_estate', 'custom_business') then
    if not v_asset_is_custom or v_asset_user_id is null then
      raise exception
        'custom identifier scheme % requires a user-owned custom asset',
        new.scheme
        using errcode = '23514';
    end if;
  end if;

  new.normalized_value := public.normalize_asset_identifier(
    new.scheme,
    new.namespace,
    new.value
  );

  return new;
end;
$$;

comment on function public.prepare_asset_identifier() is
  'Derives identifier ownership from the referenced asset and normalizes scheme, descriptive namespace, and value. Ownership exists only in user_id; namespaces describe domains such as real_estate, property, business, custom, or private_asset and never embed a user identity. Client-supplied ownership and normalized values are never trusted.';

revoke all on function public.prepare_asset_identifier() from public;
revoke all on function public.prepare_asset_identifier() from anon;
revoke all on function public.prepare_asset_identifier()
  from authenticated;

create trigger asset_identifiers_prepare
before insert or update of asset_id, scheme, namespace, value
on public.asset_identifiers
for each row
execute function public.prepare_asset_identifier();

create trigger asset_identifiers_set_updated_at
before update on public.asset_identifiers
for each row
execute function public.set_updated_at();

alter table public.asset_identifiers enable row level security;

create policy asset_identifiers_select_visible
on public.asset_identifiers
for select
to authenticated
using (
  exists (
    select 1
    from public.assets
    where assets.id = asset_identifiers.asset_id
      and (
        assets.user_id is null
        or assets.user_id = (select auth.uid())
      )
  )
);

-- Display names and bare symbols are not canonical identities.
drop index if exists public.assets_custom_user_symbol_lower_key;
drop index if exists public.assets_custom_user_name_lower_key;

create index assets_custom_user_symbol_lower_idx
on public.assets (user_id, pg_catalog.lower(pg_catalog.btrim(symbol)))
where is_custom and user_id is not null and symbol is not null;

create index assets_custom_user_name_lower_idx
on public.assets (user_id, pg_catalog.lower(pg_catalog.btrim(name)))
where is_custom and user_id is not null;

create or replace function public.require_transaction_posting_rpc()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'posted'
    and (
      tg_op = 'INSERT'
      or old.status is distinct from 'posted'
    )
    and current_setting(
      'tharwati.posting_transaction_id',
      true
    ) is distinct from new.id::text
  then
    raise exception
      'transaction % must be posted through public.post_transaction',
      new.id
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.require_transaction_posting_rpc() is
  'Blocks direct posted inserts and draft-to-posted client updates. Only the secured posting function sets the transaction-local authorization marker.';

revoke all on function public.require_transaction_posting_rpc()
  from public;
revoke all on function public.require_transaction_posting_rpc()
  from anon;
revoke all on function public.require_transaction_posting_rpc()
  from authenticated;

create trigger financial_transactions_require_posting_rpc
before insert or update of status on public.financial_transactions
for each row
execute function public.require_transaction_posting_rpc();

-- Holdings are a client-read-only cache rebuilt from posted ledger effects.
drop policy if exists holdings_insert_own on public.holdings;
drop policy if exists holdings_update_own on public.holdings;
drop policy if exists holdings_delete_own on public.holdings;

comment on column public.holdings.quantity is
  'Derived posted-ledger quantity cache. A completely closed position remains represented with quantity zero.';

comment on column public.holdings.average_cost is
  'Derived posted-ledger average-cost cache. It is null when quantity is zero; clients cannot write this value.';

comment on table public.holdings is
  'Read-only client projection of posted ledger effects. Total cost basis is not stored separately: it is the sum of posted transaction_entries.cost_basis_delta. A closed holding has quantity zero, total cost basis zero, and average_cost null.';

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
    raise exception
      'holding rebuild user is required'
      using errcode = '22023';
  end if;

  if (p_account_id is null) <> (p_asset_id is null) then
    raise exception
      'holding rebuild account and asset scopes must be supplied together'
      using errcode = '22023';
  end if;

  -- All relevant identities lock in deterministic UUID order. The advisory
  -- lock also serializes the first projection before a holding row exists.
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

  -- Validate the complete derived state before replacing cached values.
  for v_effect in
    select
      entries.account_id,
      entries.asset_id,
      coalesce(sum(entries.quantity_delta), 0::numeric) as quantity,
      coalesce(
        sum(entries.cost_basis_delta),
        0::numeric
      ) as total_cost_basis,
      min(transactions.transaction_currency_code)
        as cost_currency_code,
      count(distinct transactions.transaction_currency_code)
        as cost_currency_count
    from public.transaction_entries as entries
    join public.financial_transactions as transactions
      on transactions.id = entries.transaction_id
    where entries.user_id = p_user_id
      and entries.asset_id is not null
      and (
        entries.quantity_delta is not null
        or entries.cost_basis_delta is not null
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
    group by entries.account_id, entries.asset_id
  loop
    if v_effect.cost_currency_count <> 1 then
      raise exception
        'holding for account % and asset % has mixed cost currencies',
        v_effect.account_id,
        v_effect.asset_id
        using errcode = '23514';
    end if;

    if v_effect.quantity < 0
      or v_effect.total_cost_basis < 0
      or (
        v_effect.quantity = 0
        and v_effect.total_cost_basis <> 0
      )
    then
      raise exception
        'invalid derived holding state for account % and asset %: quantity %, cost basis %',
        v_effect.account_id,
        v_effect.asset_id,
        v_effect.quantity,
        v_effect.total_cost_basis
        using errcode = '23514';
    end if;
  end loop;

  insert into public.holdings (
    user_id,
    account_id,
    asset_id,
    quantity,
    average_cost,
    cost_currency_code
  )
  select
    entries.user_id,
    entries.account_id,
    entries.asset_id,
    sum(entries.quantity_delta),
    case
      when sum(entries.quantity_delta) > 0 then
        coalesce(sum(entries.cost_basis_delta), 0::numeric)
          / sum(entries.quantity_delta)
      else null
    end,
    min(transactions.transaction_currency_code)
  from public.transaction_entries as entries
  join public.financial_transactions as transactions
    on transactions.id = entries.transaction_id
  where entries.user_id = p_user_id
    and entries.asset_id is not null
    and (
      entries.quantity_delta is not null
      or entries.cost_basis_delta is not null
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
  group by entries.user_id, entries.account_id, entries.asset_id
  on conflict (account_id, asset_id)
  do update
  set
    quantity = excluded.quantity,
    average_cost = excluded.average_cost,
    cost_currency_code = excluded.cost_currency_code;

  -- Remove only cache rows with no posted effect history. A position whose
  -- effects sum to zero remains as a closed holding with null average cost.
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
        and (
          entries.quantity_delta is not null
          or entries.cost_basis_delta is not null
        )
        and (
          transactions.status = 'posted'
          or transactions.id = p_pending_transaction_id
        )
      group by entries.account_id, entries.asset_id
    );
end;
$$;

comment on function public.rebuild_holding_projection(uuid, uuid, uuid, uuid) is
  'Reconstructs one holding or all holdings for a user entirely from posted ledger quantity_delta and cost_basis_delta effects. An optional locked pending transaction lets posting project before the protected status transition without exposing draft effects. No prior holding quantity or average cost is read. Closed positions remain with quantity zero, ledger-derived total cost basis zero, and average_cost null. Internal only.';

revoke all on function public.rebuild_holding_projection(
  uuid,
  uuid,
  uuid,
  uuid
) from public;
revoke all on function public.rebuild_holding_projection(
  uuid,
  uuid,
  uuid,
  uuid
) from anon;
revoke all on function public.rebuild_holding_projection(
  uuid,
  uuid,
  uuid,
  uuid
) from authenticated;

create or replace function public.post_transaction(
  transaction_id uuid
)
returns public.financial_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_transaction public.financial_transactions%rowtype;
  v_effect record;
  v_entry_count bigint;
  v_debit_total numeric;
  v_credit_total numeric;
begin
  if v_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  select *
  into v_transaction
  from public.financial_transactions as transactions
  where transactions.id = post_transaction.transaction_id
    and transactions.user_id = v_user_id
    and transactions.status = 'draft'
  for update;

  if not found then
    raise exception
      'owned draft transaction % does not exist',
      transaction_id
      using errcode = 'P0002';
  end if;

  select
    count(*),
    coalesce(
      sum(transaction_amount) filter (where entry_side = 'debit'),
      0::numeric
    ),
    coalesce(
      sum(transaction_amount) filter (where entry_side = 'credit'),
      0::numeric
    )
  into v_entry_count, v_debit_total, v_credit_total
  from public.transaction_entries
  where transaction_entries.transaction_id = post_transaction.transaction_id
    and user_id = v_user_id;

  if v_entry_count < 2 or v_debit_total <> v_credit_total then
    raise exception
      'transaction % is not a valid exactly balanced ledger transaction',
      transaction_id
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.transaction_entries
    where transaction_entries.transaction_id
      = post_transaction.transaction_id
      and (
        (
          asset_id is null
          and (
            quantity_delta is not null
            or cost_basis_delta is not null
          )
        )
        or (
          cost_basis_delta is not null
          and transaction_amount <= 0
        )
      )
  ) then
    raise exception
      'transaction % contains invalid holding effects',
      transaction_id
      using errcode = '23514';
  end if;

  -- Project every affected identity in deterministic order while the parent
  -- draft row remains locked. The pending ID is included only by this call.
  for v_effect in
    select distinct account_id, asset_id
    from public.transaction_entries
    where transaction_entries.transaction_id
      = post_transaction.transaction_id
      and asset_id is not null
      and (
        quantity_delta is not null
        or cost_basis_delta is not null
      )
    order by account_id, asset_id
  loop
    perform public.rebuild_holding_projection(
      v_user_id,
      v_effect.account_id,
      v_effect.asset_id,
      transaction_id
    );
  end loop;

  perform pg_catalog.set_config(
    'tharwati.posting_transaction_id',
    transaction_id::text,
    true
  );

  update public.financial_transactions
  set status = 'posted'
  where financial_transactions.id = post_transaction.transaction_id
  returning *
  into v_transaction;

  return v_transaction;
end;
$$;

comment on function public.post_transaction(uuid) is
  'Locks and validates the authenticated user''s draft, validates exact monetary balance and explicit holding effects, rebuilds every affected holding including only that locked pending transaction, then performs the guarded posted transition. Projection and status change share one database transaction and therefore commit or roll back together.';

revoke all on function public.post_transaction(uuid) from public;
revoke all on function public.post_transaction(uuid) from anon;
revoke all on function public.post_transaction(uuid) from authenticated;
grant execute on function public.post_transaction(uuid) to authenticated;

create or replace function public.add_investment(
  p_account_id uuid,
  p_new_account_type_code text,
  p_new_account_name text,
  p_new_account_currency_code text,
  p_new_account_institution_name text,
  p_asset_id uuid,
  p_new_asset_type_code text,
  p_new_asset_name text,
  p_new_asset_symbol text,
  p_new_asset_currency_code text,
  p_new_asset_exchange text,
  p_identifier_scheme text,
  p_identifier_namespace text,
  p_identifier_value text,
  p_identifier_provider text,
  p_quantity numeric,
  p_unit_price numeric,
  p_fees numeric,
  p_account_fx_rate numeric,
  p_occurred_at timestamptz,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_account public.financial_accounts%rowtype;
  v_asset public.assets%rowtype;
  v_transaction public.financial_transactions%rowtype;
  v_holding public.holdings%rowtype;
  v_identifier public.asset_identifiers%rowtype;
  v_identifiers jsonb;
  v_entries jsonb;
  v_scheme text;
  v_namespace text;
  v_normalized_value text;
  v_gross_amount numeric;
  v_fee_amount numeric := coalesce(p_fees, 0::numeric);
  v_total_amount numeric;
  v_fx_rate numeric;
begin
  if v_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  if (p_account_id is null)
    = (nullif(pg_catalog.btrim(p_new_account_name), '') is null)
  then
    raise exception
      'select one existing account or provide one new account'
      using errcode = '22023';
  end if;

  if (p_asset_id is null)
    = (nullif(pg_catalog.btrim(p_new_asset_name), '') is null)
  then
    raise exception
      'select one existing asset or provide one new asset'
      using errcode = '22023';
  end if;

  if p_quantity is null or p_quantity <= 0
    or p_unit_price is null or p_unit_price < 0
    or v_fee_amount < 0
    or p_occurred_at is null
  then
    raise exception
      'quantity, unit price, fees, or transaction date is invalid'
      using errcode = '22023';
  end if;

  if p_account_id is not null then
    select *
    into v_account
    from public.financial_accounts
    where id = p_account_id
      and user_id = v_user_id
      and is_active
    for update;

    if not found then
      raise exception
        'selected active account % is not available',
        p_account_id
        using errcode = 'P0002';
    end if;
  else
    insert into public.financial_accounts (
      user_id,
      account_type_code,
      name,
      institution_name,
      currency_code,
      opening_balance
    )
    values (
      v_user_id,
      nullif(pg_catalog.btrim(p_new_account_type_code), ''),
      pg_catalog.btrim(p_new_account_name),
      nullif(pg_catalog.btrim(p_new_account_institution_name), ''),
      nullif(pg_catalog.btrim(p_new_account_currency_code), ''),
      0::numeric
    )
    returning * into v_account;
  end if;

  if p_asset_id is not null then
    select *
    into v_asset
    from public.assets
    where id = p_asset_id
      and is_active
      and (user_id is null or user_id = v_user_id)
    for share;

    if not found then
      raise exception
        'selected visible asset % is not available',
        p_asset_id
        using errcode = 'P0002';
    end if;
  else
    v_scheme := pg_catalog.lower(pg_catalog.btrim(p_identifier_scheme));
    v_namespace := pg_catalog.lower(
      pg_catalog.btrim(p_identifier_namespace)
    );

    if v_scheme in ('isin', 'commodity') then
      v_namespace := 'global';
    elsif v_scheme = 'precious_metal' then
      v_namespace := 'physical';
    end if;

    v_normalized_value := public.normalize_asset_identifier(
      v_scheme,
      v_namespace,
      p_identifier_value
    );

    -- A matching global canonical identity always wins.
    select assets.*
    into v_asset
    from public.asset_identifiers as identifiers
    join public.assets as assets on assets.id = identifiers.asset_id
    where identifiers.user_id is null
      and identifiers.scheme = v_scheme
      and identifiers.namespace = v_namespace
      and identifiers.normalized_value = v_normalized_value
      and assets.is_active
    limit 1
    for share of assets;

    if not found then
      select assets.*
      into v_asset
      from public.asset_identifiers as identifiers
      join public.assets as assets on assets.id = identifiers.asset_id
      where identifiers.user_id = v_user_id
        and identifiers.scheme = v_scheme
        and identifiers.namespace = v_namespace
        and identifiers.normalized_value = v_normalized_value
      limit 1
      for update of assets;
    end if;

    if not found then
      begin
        insert into public.assets (
          user_id,
          asset_type_code,
          symbol,
          name,
          currency_code,
          exchange,
          is_custom
        )
        values (
          v_user_id,
          nullif(pg_catalog.btrim(p_new_asset_type_code), ''),
          nullif(pg_catalog.btrim(p_new_asset_symbol), ''),
          pg_catalog.btrim(p_new_asset_name),
          nullif(pg_catalog.btrim(p_new_asset_currency_code), ''),
          nullif(pg_catalog.btrim(p_new_asset_exchange), ''),
          true
        )
        returning * into v_asset;

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
          v_scheme,
          v_namespace,
          p_identifier_value,
          v_normalized_value,
          nullif(pg_catalog.btrim(p_identifier_provider), ''),
          true
        )
        returning * into v_identifier;
      exception
        when unique_violation then
          select assets.*
          into v_asset
          from public.asset_identifiers as identifiers
          join public.assets as assets on assets.id = identifiers.asset_id
          where identifiers.user_id = v_user_id
            and identifiers.scheme = v_scheme
            and identifiers.namespace = v_namespace
            and identifiers.normalized_value = v_normalized_value
          limit 1
          for update of assets;

          if not found then
            raise;
          end if;
      end;
    end if;
  end if;

  if v_asset.currency_code = v_account.currency_code then
    v_fx_rate := 1::numeric;
  else
    v_fx_rate := p_account_fx_rate;

    if v_fx_rate is null or v_fx_rate <= 0 then
      raise exception
        'a positive account conversion rate is required for % to %',
        v_asset.currency_code,
        v_account.currency_code
        using errcode = '22023';
    end if;
  end if;

  v_gross_amount := p_quantity * p_unit_price;
  v_total_amount := v_gross_amount + v_fee_amount;

  if v_total_amount <= 0 then
    raise exception
      'total investment amount must be positive'
      using errcode = '22023';
  end if;

  insert into public.financial_transactions (
    user_id,
    transaction_type_code,
    transaction_currency_code,
    status,
    occurred_at,
    description,
    notes
  )
  values (
    v_user_id,
    'buy',
    v_asset.currency_code,
    'draft',
    p_occurred_at,
    'Buy ' || v_asset.name,
    nullif(pg_catalog.btrim(p_notes), '')
  )
  returning * into v_transaction;

  insert into public.transaction_entries (
    transaction_id,
    user_id,
    account_id,
    asset_id,
    entry_side,
    transaction_amount,
    account_amount,
    quantity_delta,
    cost_basis_delta,
    unit_price,
    memo
  )
  values (
    v_transaction.id,
    v_user_id,
    v_account.id,
    v_asset.id,
    'debit',
    v_gross_amount,
    v_gross_amount * v_fx_rate,
    p_quantity,
    v_gross_amount,
    p_unit_price,
    'investment_purchase'
  );

  if v_fee_amount > 0 then
    insert into public.transaction_entries (
      transaction_id,
      user_id,
      account_id,
      asset_id,
      entry_side,
      transaction_amount,
      account_amount,
      quantity_delta,
      cost_basis_delta,
      memo
    )
    values (
      v_transaction.id,
      v_user_id,
      v_account.id,
      v_asset.id,
      'debit',
      v_fee_amount,
      v_fee_amount * v_fx_rate,
      0::numeric,
      v_fee_amount,
      'investment_fee'
    );
  end if;

  insert into public.transaction_entries (
    transaction_id,
    user_id,
    account_id,
    entry_side,
    transaction_amount,
    account_amount,
    memo
  )
  values (
    v_transaction.id,
    v_user_id,
    v_account.id,
    'credit',
    v_total_amount,
    v_total_amount * v_fx_rate,
    'investment_payment'
  );

  select *
  into v_transaction
  from public.post_transaction(v_transaction.id);

  select *
  into v_holding
  from public.holdings
  where user_id = v_user_id
    and account_id = v_account.id
    and asset_id = v_asset.id;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.to_jsonb(identifier_row)
      order by identifier_row.is_primary desc, identifier_row.created_at
    ),
    '[]'::jsonb
  )
  into v_identifiers
  from public.asset_identifiers as identifier_row
  where identifier_row.asset_id = v_asset.id;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.to_jsonb(entry_row)
      order by entry_row.created_at, entry_row.id
    ),
    '[]'::jsonb
  )
  into v_entries
  from public.transaction_entries as entry_row
  where entry_row.transaction_id = v_transaction.id;

  return pg_catalog.jsonb_build_object(
    'account', pg_catalog.to_jsonb(v_account),
    'asset', pg_catalog.to_jsonb(v_asset),
    'asset_identifiers', v_identifiers,
    'transaction', pg_catalog.to_jsonb(v_transaction),
    'entries', v_entries,
    'holding', pg_catalog.to_jsonb(v_holding)
  );
end;
$$;

comment on function public.add_investment(
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  numeric,
  timestamptz,
  text
) is
  'Atomically creates or explicitly reuses the account, resolves the selected asset or a canonical identifier, creates a draft Buy with separate purchase/fee/payment entries and explicit holding effects, calls protected posting, and returns the complete result. Ownership, holding state, status, posted_at, and authorization markers are never accepted from clients. New catalog entries created by this client RPC remain user-owned custom assets; global catalog creation stays administrative.';

revoke all on function public.add_investment(
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  numeric,
  timestamptz,
  text
) from public;
revoke all on function public.add_investment(
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  numeric,
  timestamptz,
  text
) from anon;
revoke all on function public.add_investment(
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  numeric,
  timestamptz,
  text
) from authenticated;
grant execute on function public.add_investment(
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  numeric,
  timestamptz,
  text
) to authenticated;
