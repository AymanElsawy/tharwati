create table public.transaction_types (
  code text
    constraint transaction_types_pkey primary key,
  name text
    constraint transaction_types_name_not_null not null,
  description text,
  is_active boolean
    constraint transaction_types_is_active_not_null not null
    default true,
  created_at timestamptz
    constraint transaction_types_created_at_not_null not null
    default now()
);

insert into public.transaction_types (code, name)
values
  ('income', 'Income'),
  ('expense', 'Expense'),
  ('deposit', 'Deposit'),
  ('withdrawal', 'Withdrawal'),
  ('transfer', 'Transfer'),
  ('buy', 'Buy'),
  ('sell', 'Sell'),
  ('dividend', 'Dividend'),
  ('interest', 'Interest'),
  ('fee', 'Fee'),
  ('tax', 'Tax'),
  ('adjustment', 'Adjustment')
on conflict (code) do update
set name = excluded.name;

create table public.financial_transactions (
  id uuid
    constraint financial_transactions_pkey primary key
    default gen_random_uuid(),
  user_id uuid
    constraint financial_transactions_user_id_not_null not null,
  transaction_type_code text
    constraint financial_transactions_transaction_type_code_not_null not null,
  transaction_currency_code text
    constraint financial_transactions_transaction_currency_code_not_null not null,
  status text
    constraint financial_transactions_status_not_null not null
    default 'draft',
  occurred_at timestamptz
    constraint financial_transactions_occurred_at_not_null not null
    default now(),
  description text
    constraint financial_transactions_description_not_null not null,
  external_reference text,
  notes text,
  posted_at timestamptz,
  created_at timestamptz
    constraint financial_transactions_created_at_not_null not null
    default now(),
  updated_at timestamptz
    constraint financial_transactions_updated_at_not_null not null
    default now(),
  constraint financial_transactions_user_id_auth_users_fkey
    foreign key (user_id)
    references auth.users (id)
    on delete cascade,
  constraint financial_transactions_transaction_type_code_transaction_types_fkey
    foreign key (transaction_type_code)
    references public.transaction_types (code),
  constraint financial_transactions_transaction_currency_code_currencies_fkey
    foreign key (transaction_currency_code)
    references public.currencies (code),
  constraint financial_transactions_description_not_blank_check
    check (btrim(description) <> ''),
  constraint financial_transactions_status_allowed_check
    check (status in ('draft', 'posted')),
  constraint financial_transactions_status_posted_at_consistency_check
    check (
      (status = 'draft' and posted_at is null)
      or
      (status = 'posted' and posted_at is not null)
    )
);

create index financial_transactions_user_id_idx
  on public.financial_transactions (user_id);

create index financial_transactions_user_occurred_at_desc_idx
  on public.financial_transactions (user_id, occurred_at desc);

create index financial_transactions_user_status_idx
  on public.financial_transactions (user_id, status);

create index financial_transactions_user_transaction_type_code_idx
  on public.financial_transactions (user_id, transaction_type_code);

create index financial_transactions_external_reference_idx
  on public.financial_transactions (external_reference)
  where external_reference is not null;

create table public.transaction_entries (
  id uuid
    constraint transaction_entries_pkey primary key
    default gen_random_uuid(),
  transaction_id uuid
    constraint transaction_entries_transaction_id_not_null not null,
  user_id uuid
    constraint transaction_entries_user_id_not_null not null,
  account_id uuid
    constraint transaction_entries_account_id_not_null not null,
  asset_id uuid,
  entry_side text
    constraint transaction_entries_entry_side_not_null not null,
  transaction_amount numeric(30, 10)
    constraint transaction_entries_transaction_amount_not_null not null,
  account_amount numeric(30, 10)
    constraint transaction_entries_account_amount_not_null not null,
  quantity_delta numeric(30, 10),
  unit_price numeric(30, 10),
  memo text,
  created_at timestamptz
    constraint transaction_entries_created_at_not_null not null
    default now(),
  updated_at timestamptz
    constraint transaction_entries_updated_at_not_null not null
    default now(),
  constraint transaction_entries_transaction_id_financial_transactions_fkey
    foreign key (transaction_id)
    references public.financial_transactions (id)
    on delete cascade,
  constraint transaction_entries_user_id_auth_users_fkey
    foreign key (user_id)
    references auth.users (id)
    on delete cascade,
  constraint transaction_entries_account_id_financial_accounts_fkey
    foreign key (account_id)
    references public.financial_accounts (id)
    on delete restrict,
  constraint transaction_entries_asset_id_assets_fkey
    foreign key (asset_id)
    references public.assets (id)
    on delete restrict,
  constraint transaction_entries_entry_side_allowed_check
    check (entry_side in ('debit', 'credit')),
  constraint transaction_entries_transaction_amount_positive_check
    check (transaction_amount > 0),
  constraint transaction_entries_account_amount_positive_check
    check (account_amount > 0),
  constraint transaction_entries_unit_price_non_negative_check
    check (unit_price is null or unit_price >= 0),
  constraint transaction_entries_quantity_delta_non_zero_check
    check (quantity_delta is null or quantity_delta <> 0),
  constraint transaction_entries_asset_values_consistency_check
    check (
      (asset_id is null and quantity_delta is null and unit_price is null)
      or
      asset_id is not null
    )
);

create index transaction_entries_transaction_id_idx
  on public.transaction_entries (transaction_id);

create index transaction_entries_user_id_idx
  on public.transaction_entries (user_id);

create index transaction_entries_account_id_idx
  on public.transaction_entries (account_id);

create index transaction_entries_asset_id_idx
  on public.transaction_entries (asset_id)
  where asset_id is not null;

create index transaction_entries_user_created_at_desc_idx
  on public.transaction_entries (user_id, created_at desc);

create or replace function public.validate_transaction_entry_relationships()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.financial_transactions
    where id = new.transaction_id
      and user_id = new.user_id
  ) then
    raise exception
      'transaction entry user % does not own transaction %',
      new.user_id,
      new.transaction_id
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.financial_accounts
    where id = new.account_id
      and user_id = new.user_id
  ) then
    raise exception
      'transaction entry account % is not owned by user %',
      new.account_id,
      new.user_id
      using errcode = '23514';
  end if;

  if new.asset_id is not null and not exists (
    select 1
    from public.assets
    where id = new.asset_id
      and (user_id is null or user_id = new.user_id)
  ) then
    raise exception
      'transaction entry asset % is neither global nor owned by user %',
      new.asset_id,
      new.user_id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

comment on function public.validate_transaction_entry_relationships() is
  'Prevents cross-user ledger relationships by validating the parent transaction, account owner, and optional asset owner. account_amount is structurally denominated in the referenced account currency, so no competing entry currency column exists. SECURITY DEFINER permits stable checks through RLS; all objects are schema-qualified and search_path is empty.';

create or replace function public.set_transaction_posted_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'draft' then
    new.posted_at = null;
  elsif new.status = 'posted' then
    new.posted_at = now();
  end if;

  return new;
end;
$$;

comment on function public.set_transaction_posted_at() is
  'Makes posted_at server-controlled: drafts always have no posting timestamp, while direct posted inserts and draft-to-posted transitions receive the current database transaction timestamp. The trigger runs before status consistency constraints are checked.';

create or replace function public.prevent_posted_transaction_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'posted' and tg_op = 'UPDATE' then
    raise exception
      'posted transaction % is immutable and cannot be updated',
      old.id
      using errcode = '55000';
  end if;

  if old.status = 'posted'
    and tg_op = 'DELETE'
    and exists (
      select 1
      from auth.users
      where id = old.user_id
    )
  then
    raise exception
      'posted transaction % cannot be deleted while its owning user exists',
      old.id
      using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

comment on function public.prevent_posted_transaction_changes() is
  'Rejects all posted transaction updates and direct deletes while the owning auth.users row exists. A missing auth.users row explicitly identifies its cascading user deletion, allowing full user-data cleanup without relying on caller roles. SECURITY DEFINER permits the auth.users check with an empty search_path.';

create or replace function public.prevent_posted_transaction_entry_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_parent_user_id uuid;
  old_parent_status text;
  new_parent_user_id uuid;
  new_parent_status text;
begin
  if tg_op = 'INSERT' then
    select user_id, status
    into new_parent_user_id, new_parent_status
    from public.financial_transactions
    where id = new.transaction_id
    for update;

    if not found then
      raise exception
        'transaction entry parent transaction % does not exist',
        new.transaction_id
        using errcode = '23503';
    end if;

    if new_parent_user_id <> new.user_id then
      raise exception
        'transaction entry user % does not own transaction %',
        new.user_id,
        new.transaction_id
        using errcode = '23514';
    end if;

    if new_parent_status <> 'draft' then
      raise exception
        'entries of posted transaction % are immutable',
        new.transaction_id
        using errcode = '55000';
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.transaction_id = new.transaction_id then
      select user_id, status
      into new_parent_user_id, new_parent_status
      from public.financial_transactions
      where id = new.transaction_id
      for update;
    else
      -- Lock moved-entry parents in UUID order so competing moves agree on order.
      perform id
      from public.financial_transactions
      where id in (old.transaction_id, new.transaction_id)
      order by id
      for update;

      select user_id, status
      into old_parent_user_id, old_parent_status
      from public.financial_transactions
      where id = old.transaction_id;

      if not found then
        raise exception
          'transaction entry original parent transaction % does not exist',
          old.transaction_id
          using errcode = '23503';
      end if;

      if old_parent_user_id <> old.user_id then
        raise exception
          'transaction entry user % does not own original transaction %',
          old.user_id,
          old.transaction_id
          using errcode = '23514';
      end if;

      if old_parent_status <> 'draft' then
        raise exception
          'entries of posted transaction % are immutable',
          old.transaction_id
          using errcode = '55000';
      end if;

      select user_id, status
      into new_parent_user_id, new_parent_status
      from public.financial_transactions
      where id = new.transaction_id;
    end if;

    if not found then
      raise exception
        'transaction entry parent transaction % does not exist',
        new.transaction_id
        using errcode = '23503';
    end if;

    if new_parent_user_id <> new.user_id then
      raise exception
        'transaction entry user % does not own transaction %',
        new.user_id,
        new.transaction_id
        using errcode = '23514';
    end if;

    if new_parent_status <> 'draft' then
      raise exception
        'entries of posted transaction % are immutable',
        new.transaction_id
        using errcode = '55000';
    end if;

    return new;
  end if;

  select status
  into old_parent_status
  from public.financial_transactions
  where id = old.transaction_id
  for update;

  if not found then
    -- The parent is already gone while its approved cascade deletes entries.
    return old;
  end if;

  if old_parent_status <> 'draft' then
    raise exception
      'entries of posted transaction % are immutable',
      old.transaction_id
      using errcode = '55000';
  end if;

  return old;
end;
$$;

comment on function public.prevent_posted_transaction_entry_changes() is
  'Serializes entry mutations against posting by locking every affected financial_transactions row FOR UPDATE before checking ownership and draft status. Moved-entry parents are locked in ascending UUID order to reduce deadlock risk. A missing parent is allowed only on DELETE so an approved parent/user cascade can remove entries. SECURITY DEFINER permits stable checks through RLS with an empty search_path.';

create or replace function public.assert_transaction_balanced(
  target_transaction_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_status text;
  entry_count bigint;
  debit_total numeric;
  credit_total numeric;
begin
  select status
  into target_status
  from public.financial_transactions
  where id = target_transaction_id;

  if not found or target_status <> 'posted' then
    return;
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
  into entry_count, debit_total, credit_total
  from public.transaction_entries
  where transaction_id = target_transaction_id;

  if entry_count < 2 then
    raise exception
      'posted transaction % must contain at least two entries',
      target_transaction_id
      using errcode = '23514';
  end if;

  if debit_total <> credit_total then
    raise exception
      'posted transaction % is unbalanced: debits %, credits %',
      target_transaction_id,
      debit_total,
      credit_total
      using errcode = '23514';
  end if;
end;
$$;

comment on function public.assert_transaction_balanced(uuid) is
  'Validates posted transactions with exact numeric transaction_amount totals. account_amount is intentionally excluded because account-native amounts may differ in cross-currency transfers. SECURITY DEFINER permits complete ledger reads through RLS with an empty search_path.';

create or replace function public.validate_changed_transaction_entry_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.assert_transaction_balanced(new.transaction_id);
  elsif tg_op = 'UPDATE' then
    perform public.assert_transaction_balanced(old.transaction_id);

    if new.transaction_id is distinct from old.transaction_id then
      perform public.assert_transaction_balanced(new.transaction_id);
    end if;
  elsif tg_op = 'DELETE' then
    perform public.assert_transaction_balanced(old.transaction_id);
  end if;

  return null;
end;
$$;

comment on function public.validate_changed_transaction_entry_balance() is
  'Deferred constraint-trigger adapter that validates final ledger state and checks both OLD and NEW parent transactions when an entry moves.';

create or replace function public.validate_financial_transaction_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_transaction_balanced(new.id);
  return null;
end;
$$;

comment on function public.validate_financial_transaction_balance() is
  'Deferred constraint-trigger adapter that validates direct insertion or posting of a transaction after all entry changes in the database transaction complete.';

-- These functions are trigger/internal security boundaries, not client RPCs.
revoke all on function public.validate_transaction_entry_relationships() from public;
revoke all on function public.validate_transaction_entry_relationships() from anon;
revoke all on function public.validate_transaction_entry_relationships() from authenticated;
revoke all on function public.set_transaction_posted_at() from public;
revoke all on function public.set_transaction_posted_at() from anon;
revoke all on function public.set_transaction_posted_at() from authenticated;
revoke all on function public.prevent_posted_transaction_changes() from public;
revoke all on function public.prevent_posted_transaction_changes() from anon;
revoke all on function public.prevent_posted_transaction_changes() from authenticated;
revoke all on function public.prevent_posted_transaction_entry_changes() from public;
revoke all on function public.prevent_posted_transaction_entry_changes() from anon;
revoke all on function public.prevent_posted_transaction_entry_changes() from authenticated;
revoke all on function public.assert_transaction_balanced(uuid) from public;
revoke all on function public.assert_transaction_balanced(uuid) from anon;
revoke all on function public.assert_transaction_balanced(uuid) from authenticated;
revoke all on function public.validate_changed_transaction_entry_balance() from public;
revoke all on function public.validate_changed_transaction_entry_balance() from anon;
revoke all on function public.validate_changed_transaction_entry_balance() from authenticated;
revoke all on function public.validate_financial_transaction_balance() from public;
revoke all on function public.validate_financial_transaction_balance() from anon;
revoke all on function public.validate_financial_transaction_balance() from authenticated;

create trigger financial_transactions_prevent_posted_changes
before update or delete on public.financial_transactions
for each row
execute function public.prevent_posted_transaction_changes();

create trigger financial_transactions_set_posted_at
before insert or update on public.financial_transactions
for each row
execute function public.set_transaction_posted_at();

create trigger transaction_entries_prevent_posted_changes
before insert or update or delete on public.transaction_entries
for each row
execute function public.prevent_posted_transaction_entry_changes();

create trigger transaction_entries_validate_relationships
before insert or update of transaction_id, user_id, account_id, asset_id
on public.transaction_entries
for each row
execute function public.validate_transaction_entry_relationships();

create constraint trigger transaction_entries_validate_balance
after insert or update or delete on public.transaction_entries
deferrable initially deferred
for each row
execute function public.validate_changed_transaction_entry_balance();

create constraint trigger financial_transactions_validate_balance
after insert or update on public.financial_transactions
deferrable initially deferred
for each row
execute function public.validate_financial_transaction_balance();

create trigger financial_transactions_set_updated_at
before update on public.financial_transactions
for each row
execute function public.set_updated_at();

create trigger transaction_entries_set_updated_at
before update on public.transaction_entries
for each row
execute function public.set_updated_at();

alter table public.transaction_types enable row level security;
alter table public.financial_transactions enable row level security;
alter table public.transaction_entries enable row level security;

create policy transaction_types_select_active
on public.transaction_types
for select
to authenticated
using (is_active);

create policy financial_transactions_select_own
on public.financial_transactions
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy financial_transactions_insert_own
on public.financial_transactions
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy financial_transactions_update_own
on public.financial_transactions
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy financial_transactions_delete_own
on public.financial_transactions
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy transaction_entries_select_own
on public.transaction_entries
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy transaction_entries_insert_own
on public.transaction_entries
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy transaction_entries_update_own
on public.transaction_entries
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy transaction_entries_delete_own
on public.transaction_entries
for delete
to authenticated
using ((select auth.uid()) = user_id);
