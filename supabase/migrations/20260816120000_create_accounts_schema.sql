-- Minimal, self-contained schema for the accounts feature only.
-- This project starts fresh and intentionally does not recreate the
-- holdings/transactions/assets ledger from the previous Supabase project.

create table public.account_types (
  code text primary key,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.account_types (code, name) values
  ('cash', 'Cash'),
  ('bank', 'Bank'),
  ('brokerage', 'Brokerage'),
  ('gold', 'Gold/Silver'),
  ('real_estate', 'Real Estate'),
  ('business', 'Business'),
  ('other', 'Other');

alter table public.account_types enable row level security;

create policy "account_types_select_active"
  on public.account_types
  for select
  to authenticated
  using (is_active = true);

grant select on public.account_types to authenticated;

create table public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_type_code text not null references public.account_types (code),
  name text not null,
  currency_code text not null,
  opening_balance numeric(20, 2) not null default 0,
  is_active boolean not null default true,
  notes text,
  bank_subtype text,
  investment_type text,
  balance_grams numeric(20, 3),
  property_type text,
  ownership_percentage numeric(5, 2),
  business_type text,
  industry text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_accounts_name_not_blank_check check (btrim(name) <> ''),
  constraint financial_accounts_currency_code_check
    check (currency_code in ('USD', 'SAR', 'EGP', 'EUR', 'GBP')),
  constraint financial_accounts_bank_subtype_check check (
    bank_subtype is null
    or (account_type_code = 'bank' and bank_subtype in ('debit', 'credit'))
  ),
  constraint financial_accounts_investment_type_check check (
    investment_type is null
    or (
      account_type_code = 'brokerage'
      and investment_type in ('stock_etf', 'crypto', 'other')
    )
  ),
  constraint financial_accounts_balance_grams_check check (
    balance_grams is null or account_type_code = 'gold'
  ),
  constraint financial_accounts_property_type_check check (
    property_type is null
    or (
      account_type_code = 'real_estate'
      and property_type in ('apartment', 'villa', 'land', 'office', 'other')
    )
  ),
  constraint financial_accounts_ownership_percentage_check check (
    ownership_percentage is null
    or (
      account_type_code in ('real_estate', 'business')
      and ownership_percentage between 0 and 100
    )
  ),
  constraint financial_accounts_business_type_check check (
    business_type is null or account_type_code = 'business'
  ),
  constraint financial_accounts_industry_check check (
    industry is null or account_type_code = 'business'
  )
);

create unique index financial_accounts_user_name_lower_key
  on public.financial_accounts (user_id, lower(btrim(name)));

create index financial_accounts_user_id_idx
  on public.financial_accounts (user_id);

create index financial_accounts_user_account_type_code_idx
  on public.financial_accounts (user_id, account_type_code);

alter table public.financial_accounts enable row level security;

create policy "financial_accounts_select_own"
  on public.financial_accounts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "financial_accounts_insert_own"
  on public.financial_accounts
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "financial_accounts_update_own"
  on public.financial_accounts
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "financial_accounts_delete_own"
  on public.financial_accounts
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.financial_accounts to authenticated;

create function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger financial_accounts_set_updated_at
  before update on public.financial_accounts
  for each row execute function public.set_updated_at();
