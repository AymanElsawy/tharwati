-- Minimal cash/bank ledger foundation for the Accounts Record flow.
-- The current project intentionally omitted the legacy asset/portfolio ledger.

create table if not exists public.transaction_types (
  code text primary key,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.transaction_types (code, name)
values ('income', 'Income'), ('expense', 'Expense'), ('transfer', 'Transfer')
on conflict (code) do update set name = excluded.name, is_active = true;

create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  transaction_type_code text not null references public.transaction_types (code),
  transaction_currency_code text not null,
  status text not null default 'draft',
  occurred_at timestamptz not null default now(),
  description text not null,
  external_reference text,
  notes text,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_transactions_description_not_blank_check
    check (btrim(description) <> ''),
  constraint financial_transactions_status_allowed_check
    check (status in ('draft', 'posted')),
  constraint financial_transactions_status_posted_at_consistency_check
    check (
      (status = 'draft' and posted_at is null)
      or (status = 'posted' and posted_at is not null)
    )
);

create table if not exists public.transaction_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null
    references public.financial_transactions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid references public.financial_accounts (id) on delete restrict,
  asset_id uuid,
  entry_side text not null,
  transaction_amount numeric(30, 10) not null,
  account_amount numeric(30, 10) not null,
  quantity_delta numeric(30, 10),
  unit_price numeric(30, 10),
  memo text,
  purity text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transaction_entries_entry_side_allowed_check
    check (entry_side in ('debit', 'credit')),
  constraint transaction_entries_transaction_amount_positive_check
    check (transaction_amount > 0),
  constraint transaction_entries_account_amount_positive_check
    check (account_amount > 0),
  constraint transaction_entries_accountless_owner_contribution_check check (
    account_id is not null
    or (
      memo = 'owner_contribution'
      and asset_id is null
      and quantity_delta is null
      and unit_price is null
      and purity is null
    )
  )
);

create index if not exists financial_transactions_user_occurred_at_desc_idx
  on public.financial_transactions (user_id, occurred_at desc);
create index if not exists financial_transactions_user_status_idx
  on public.financial_transactions (user_id, status);
create index if not exists transaction_entries_transaction_id_idx
  on public.transaction_entries (transaction_id);
create index if not exists transaction_entries_user_id_idx
  on public.transaction_entries (user_id);
create index if not exists transaction_entries_account_id_idx
  on public.transaction_entries (account_id)
  where account_id is not null;
create index if not exists transaction_entries_account_cash_effect_idx
  on public.transaction_entries (account_id, transaction_id)
  include (entry_side, account_amount)
  where account_id is not null and asset_id is null;

create or replace function public.set_account_record_transaction_posted_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'draft' then
    new.posted_at := null;
  elsif old.status is distinct from 'posted' then
    new.posted_at := now();
  end if;
  return new;
end;
$$;

create or replace function public.prevent_posted_account_record_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'posted' then
    raise exception 'posted transaction % is immutable', old.id
      using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.prevent_posted_account_record_entry_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
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

create or replace function public.validate_account_record_entry_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.financial_transactions
    where id = new.transaction_id and user_id = new.user_id
  ) then
    raise exception 'transaction entry does not belong to its transaction owner'
      using errcode = '23514';
  end if;
  if new.account_id is not null and not exists (
    select 1 from public.financial_accounts
    where id = new.account_id and user_id = new.user_id
      and account_type_code in ('cash', 'bank')
  ) then
    raise exception 'transaction entry account is not an owned cash or bank account'
      using errcode = '23514';
  end if;
  if new.asset_id is not null or new.quantity_delta is not null
    or new.unit_price is not null or new.purity is not null then
    raise exception 'account records cannot contain asset or quantity effects'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.assert_account_record_transaction_balanced(
  p_transaction_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
  return v_transaction;
end;
$$;

create or replace function public.get_account_balances(
  p_account_ids uuid[] default null
)
returns table (
  account_id uuid,
  account_type_code text,
  account_name text,
  currency_code text,
  is_active boolean,
  opening_balance text,
  ledger_effect text,
  current_balance text
)
language sql
stable
security definer
set search_path = ''
as $$
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
  from public.financial_accounts accounts
  left join public.transaction_entries entries
    on entries.account_id = accounts.id and entries.asset_id is null
  left join public.financial_transactions transactions
    on transactions.id = entries.transaction_id
    and transactions.user_id = accounts.user_id
  where accounts.user_id = auth.uid()
    and accounts.account_type_code in ('cash', 'bank')
    and (p_account_ids is null or accounts.id = any(p_account_ids))
  group by accounts.id;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'account_record_transactions_set_posted_at') then
    create trigger account_record_transactions_set_posted_at
      before insert or update of status on public.financial_transactions
      for each row execute function public.set_account_record_transaction_posted_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'account_record_transactions_prevent_posted_changes') then
    create trigger account_record_transactions_prevent_posted_changes
      before update or delete on public.financial_transactions
      for each row execute function public.prevent_posted_account_record_changes();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'account_record_entries_prevent_posted_changes') then
    create trigger account_record_entries_prevent_posted_changes
      before insert or update or delete on public.transaction_entries
      for each row execute function public.prevent_posted_account_record_entry_changes();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'account_record_entries_validate_ownership') then
    create trigger account_record_entries_validate_ownership
      before insert or update on public.transaction_entries
      for each row execute function public.validate_account_record_entry_ownership();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'financial_transactions_set_updated_at') then
    create trigger financial_transactions_set_updated_at
      before update on public.financial_transactions
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'transaction_entries_set_updated_at') then
    create trigger transaction_entries_set_updated_at
      before update on public.transaction_entries
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.transaction_types enable row level security;
alter table public.financial_transactions enable row level security;
alter table public.transaction_entries enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'transaction_types' and policyname = 'account_record_transaction_types_select') then
    create policy account_record_transaction_types_select on public.transaction_types
      for select to authenticated using (code in ('income', 'expense', 'transfer') and is_active);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'financial_transactions' and policyname = 'account_record_transactions_select_own') then
    create policy account_record_transactions_select_own on public.financial_transactions
      for select to authenticated using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'transaction_entries' and policyname = 'account_record_entries_select_own') then
    create policy account_record_entries_select_own on public.transaction_entries
      for select to authenticated using (user_id = auth.uid());
  end if;
end $$;

revoke all on table public.transaction_types from public, anon, authenticated;
revoke all on table public.financial_transactions from public, anon, authenticated;
revoke all on table public.transaction_entries from public, anon, authenticated;
grant select on table public.transaction_types to authenticated;
grant select on table public.financial_transactions to authenticated;
grant select on table public.transaction_entries to authenticated;

revoke all on function public.set_account_record_transaction_posted_at() from public, anon, authenticated;
revoke all on function public.prevent_posted_account_record_changes() from public, anon, authenticated;
revoke all on function public.prevent_posted_account_record_entry_changes() from public, anon, authenticated;
revoke all on function public.validate_account_record_entry_ownership() from public, anon, authenticated;
revoke all on function public.assert_account_record_transaction_balanced(uuid) from public, anon, authenticated;
revoke all on function public.post_transaction(uuid) from public, anon, authenticated;
revoke all on function public.get_account_balances(uuid[]) from public, anon, authenticated;
grant execute on function public.get_account_balances(uuid[]) to authenticated;
