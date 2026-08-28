create table public.account_types (
  code text
    constraint account_types_pkey primary key,
  name text
    constraint account_types_name_not_null not null,
  description text,
  is_active boolean
    constraint account_types_is_active_not_null not null
    default true,
  created_at timestamptz
    constraint account_types_created_at_not_null not null
    default now()
);

insert into public.account_types (code, name)
values
  ('cash', 'Cash'),
  ('bank', 'Bank'),
  ('brokerage', 'Brokerage'),
  ('retirement', 'Retirement'),
  ('deposit', 'Deposit'),
  ('gold', 'Gold'),
  ('real_estate', 'Real Estate'),
  ('business', 'Business'),
  ('other', 'Other')
on conflict (code) do update
set name = excluded.name;

create table public.financial_accounts (
  id uuid
    constraint financial_accounts_pkey primary key
    default gen_random_uuid(),
  user_id uuid
    constraint financial_accounts_user_id_not_null not null,
  account_type_code text
    constraint financial_accounts_account_type_code_not_null not null,
  name text
    constraint financial_accounts_name_not_null not null,
  institution_name text,
  currency_code text
    constraint financial_accounts_currency_code_not_null not null,
  opening_balance numeric(20, 2)
    constraint financial_accounts_opening_balance_not_null not null
    default 0,
  is_active boolean
    constraint financial_accounts_is_active_not_null not null
    default true,
  notes text,
  created_at timestamptz
    constraint financial_accounts_created_at_not_null not null
    default now(),
  updated_at timestamptz
    constraint financial_accounts_updated_at_not_null not null
    default now(),
  constraint financial_accounts_user_id_auth_users_fkey
    foreign key (user_id)
    references auth.users (id)
    on delete cascade,
  constraint financial_accounts_account_type_code_account_types_fkey
    foreign key (account_type_code)
    references public.account_types (code),
  constraint financial_accounts_currency_code_currencies_fkey
    foreign key (currency_code)
    references public.currencies (code),
  constraint financial_accounts_name_not_blank_check
    check (btrim(name) <> '')
);

create unique index financial_accounts_user_name_lower_key
  on public.financial_accounts (user_id, lower(btrim(name)));

create index financial_accounts_user_id_idx
  on public.financial_accounts (user_id);

create index financial_accounts_user_account_type_code_idx
  on public.financial_accounts (user_id, account_type_code);

create index financial_accounts_user_is_active_idx
  on public.financial_accounts (user_id, is_active);

create table public.asset_types (
  code text
    constraint asset_types_pkey primary key,
  name text
    constraint asset_types_name_not_null not null,
  description text,
  is_active boolean
    constraint asset_types_is_active_not_null not null
    default true,
  created_at timestamptz
    constraint asset_types_created_at_not_null not null
    default now()
);

insert into public.asset_types (code, name)
values
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
set name = excluded.name;

create table public.assets (
  id uuid
    constraint assets_pkey primary key
    default gen_random_uuid(),
  user_id uuid,
  asset_type_code text
    constraint assets_asset_type_code_not_null not null,
  symbol text,
  name text
    constraint assets_name_not_null not null,
  currency_code text
    constraint assets_currency_code_not_null not null,
  exchange text,
  is_custom boolean
    constraint assets_is_custom_not_null not null
    default true,
  is_active boolean
    constraint assets_is_active_not_null not null
    default true,
  created_at timestamptz
    constraint assets_created_at_not_null not null
    default now(),
  updated_at timestamptz
    constraint assets_updated_at_not_null not null
    default now(),
  constraint assets_user_id_auth_users_fkey
    foreign key (user_id)
    references auth.users (id)
    on delete cascade,
  constraint assets_asset_type_code_asset_types_fkey
    foreign key (asset_type_code)
    references public.asset_types (code),
  constraint assets_currency_code_currencies_fkey
    foreign key (currency_code)
    references public.currencies (code),
  constraint assets_name_not_blank_check
    check (btrim(name) <> ''),
  constraint assets_scope_consistency_check
    check (
      (user_id is null and not is_custom)
      or
      (user_id is not null and is_custom)
    )
);

create unique index assets_custom_user_symbol_lower_key
  on public.assets (user_id, lower(btrim(symbol)))
  where is_custom and user_id is not null and symbol is not null;

create unique index assets_custom_user_name_lower_key
  on public.assets (user_id, lower(btrim(name)))
  where is_custom and user_id is not null;

create table public.holdings (
  id uuid
    constraint holdings_pkey primary key
    default gen_random_uuid(),
  user_id uuid
    constraint holdings_user_id_not_null not null,
  account_id uuid
    constraint holdings_account_id_not_null not null,
  asset_id uuid
    constraint holdings_asset_id_not_null not null,
  quantity numeric(30, 10)
    constraint holdings_quantity_not_null not null
    default 0,
  average_cost numeric(30, 10),
  cost_currency_code text
    constraint holdings_cost_currency_code_not_null not null,
  notes text,
  created_at timestamptz
    constraint holdings_created_at_not_null not null
    default now(),
  updated_at timestamptz
    constraint holdings_updated_at_not_null not null
    default now(),
  constraint holdings_user_id_auth_users_fkey
    foreign key (user_id)
    references auth.users (id)
    on delete cascade,
  constraint holdings_account_id_financial_accounts_fkey
    foreign key (account_id)
    references public.financial_accounts (id)
    on delete cascade,
  constraint holdings_asset_id_assets_fkey
    foreign key (asset_id)
    references public.assets (id)
    on delete restrict,
  constraint holdings_cost_currency_code_currencies_fkey
    foreign key (cost_currency_code)
    references public.currencies (code),
  constraint holdings_quantity_non_negative_check
    check (quantity >= 0),
  constraint holdings_average_cost_non_negative_check
    check (average_cost is null or average_cost >= 0),
  constraint holdings_account_id_asset_id_key
    unique (account_id, asset_id)
);

create index holdings_user_id_idx
  on public.holdings (user_id);

create index holdings_account_id_idx
  on public.holdings (account_id);

create index holdings_asset_id_idx
  on public.holdings (asset_id);

create or replace function public.validate_holding_account_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.financial_accounts
    where id = new.account_id
      and user_id = new.user_id
  ) then
    raise exception
      'holding account % is not owned by user %',
      new.account_id,
      new.user_id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

comment on function public.validate_holding_account_ownership() is
  'Prevents cross-user holdings by requiring holdings.user_id to match the account owner. SECURITY DEFINER permits a stable ownership lookup through RLS; all references are schema-qualified and search_path is empty.';

create or replace function public.validate_holding_asset_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.assets
    where id = new.asset_id
      and (user_id is null or user_id = new.user_id)
  ) then
    raise exception
      'holding asset % is neither global nor owned by user %',
      new.asset_id,
      new.user_id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

comment on function public.validate_holding_asset_ownership() is
  'Prevents cross-user holdings by allowing only global assets or assets owned by holdings.user_id. SECURITY DEFINER permits a stable ownership lookup through RLS; all references are schema-qualified and search_path is empty.';

-- Trigger functions are invoked by PostgreSQL and must not be client-callable.
revoke all on function public.validate_holding_account_ownership() from public;
revoke all on function public.validate_holding_account_ownership() from anon;
revoke all on function public.validate_holding_account_ownership() from authenticated;
revoke all on function public.validate_holding_asset_ownership() from public;
revoke all on function public.validate_holding_asset_ownership() from anon;
revoke all on function public.validate_holding_asset_ownership() from authenticated;

create trigger holdings_validate_account_ownership
before insert or update of user_id, account_id on public.holdings
for each row
execute function public.validate_holding_account_ownership();

create trigger holdings_validate_asset_ownership
before insert or update of user_id, asset_id on public.holdings
for each row
execute function public.validate_holding_asset_ownership();

create trigger financial_accounts_set_updated_at
before update on public.financial_accounts
for each row
execute function public.set_updated_at();

create trigger assets_set_updated_at
before update on public.assets
for each row
execute function public.set_updated_at();

create trigger holdings_set_updated_at
before update on public.holdings
for each row
execute function public.set_updated_at();

alter table public.account_types enable row level security;
alter table public.financial_accounts enable row level security;
alter table public.asset_types enable row level security;
alter table public.assets enable row level security;
alter table public.holdings enable row level security;

create policy account_types_select_active
on public.account_types
for select
to authenticated
using (is_active);

create policy financial_accounts_select_own
on public.financial_accounts
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy financial_accounts_insert_own
on public.financial_accounts
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy financial_accounts_update_own
on public.financial_accounts
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy financial_accounts_delete_own
on public.financial_accounts
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy asset_types_select_active
on public.asset_types
for select
to authenticated
using (is_active);

create policy assets_select_visible
on public.assets
for select
to authenticated
using (user_id is null or (select auth.uid()) = user_id);

create policy assets_insert_own
on public.assets
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy assets_update_own
on public.assets
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy assets_delete_own
on public.assets
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy holdings_select_own
on public.holdings
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy holdings_insert_own
on public.holdings
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy holdings_update_own
on public.holdings
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy holdings_delete_own
on public.holdings
for delete
to authenticated
using ((select auth.uid()) = user_id);
