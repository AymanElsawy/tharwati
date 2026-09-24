-- Historical mutations must use the existing append-only business RPCs.
revoke insert, update, delete, maintain on public.metal_purchases from authenticated;
drop policy if exists metal_purchases_insert_own on public.metal_purchases;
grant select on public.metal_purchases to authenticated;

create function public.prevent_financial_history_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Match the posted-ledger exception: only the auth.users deletion cascade.
  if tg_op = 'DELETE' and not exists (
    select 1 from auth.users where id = old.user_id
  ) then
    return old;
  end if;

  raise exception '% history is immutable; use its correction or reversal flow', tg_table_name
    using errcode = '55000';
end;
$$;

revoke all on function public.prevent_financial_history_changes()
  from public, anon, authenticated;

create trigger metal_purchases_prevent_history_changes
before update or delete on public.metal_purchases
for each row execute function public.prevent_financial_history_changes();

create trigger metal_lifecycle_prevent_history_changes
before update or delete on public.metal_purchase_lifecycle_events
for each row execute function public.prevent_financial_history_changes();

create trigger account_valuations_prevent_history_changes
before update or delete on public.account_valuations
for each row execute function public.prevent_financial_history_changes();

create trigger account_disposals_prevent_history_changes
before update or delete on public.account_disposals
for each row execute function public.prevent_financial_history_changes();

-- Do not turn a funding-account cascade into an UPDATE of immutable history.
-- Like the other history cross-links, enforce this FK after the whole user
-- graph has been deleted. A standalone account deletion remains forbidden.
alter table public.metal_purchases
  drop constraint metal_purchases_funding_account_id_fkey,
  add constraint metal_purchases_funding_account_id_fkey
    foreign key (funding_account_id) references public.financial_accounts (id)
    on delete no action deferrable initially deferred;

create or replace function public.prevent_posted_account_record_entry_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_parent uuid;
  v_new_parent uuid;
  v_parent record;
begin
  if tg_op = 'DELETE' and not exists (
    select 1 from auth.users where id = old.user_id
  ) then
    return old;
  end if;

  if tg_op <> 'INSERT' then v_old_parent := old.transaction_id; end if;
  if tg_op <> 'DELETE' then v_new_parent := new.transaction_id; end if;

  -- Lock both parents in deterministic order, including the source of an
  -- UPDATE. The same row lock serializes entry changes with post_transaction.
  for v_parent in
    select id, status from public.financial_transactions
    where id in (v_old_parent, v_new_parent)
    order by id
    for update
  loop
    if v_parent.status = 'posted' then
      raise exception 'entries of posted transaction are immutable'
        using errcode = '55000';
    end if;
  end loop;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.prevent_posted_account_record_entry_changes()
  from public, anon, authenticated;

create function public.prevent_account_history_field_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.opening_balance is not distinct from old.opening_balance
    and new.currency_code is not distinct from old.currency_code
    and new.account_type_code is not distinct from old.account_type_code then
    return new;
  end if;

  -- UPDATE already locks this account row. Supported history writers take
  -- FOR UPDATE on the same account before validation/insertion. Include draft
  -- entries and ineffective history, matching get_account_lifecycle_state.
  if exists (
    select 1 from public.transaction_entries where account_id = old.id
    union all select 1 from public.holdings where account_id = old.id
    union all select 1 from public.metal_purchases where account_id = old.id
    union all select 1 from public.metal_purchases where funding_account_id = old.id
    union all select 1 from public.account_valuations where account_id = old.id
    union all select 1 from public.account_disposals where account_id = old.id
  ) then
    if new.currency_code is distinct from old.currency_code then
      raise exception 'This account already contains financial history. Its currency cannot be changed.'
        using errcode = '23514',
          constraint = 'financial_accounts_currency_immutable_after_history_check';
    end if;
    if new.opening_balance is distinct from old.opening_balance then
      raise exception 'This account already contains financial history. Its opening balance cannot be changed.'
        using errcode = '23514',
          constraint = 'financial_accounts_opening_balance_immutable_after_history_check';
    end if;
    raise exception 'This account already contains financial history. Its account type cannot be changed.'
      using errcode = '23514',
        constraint = 'financial_accounts_type_immutable_after_history_check';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_account_history_field_changes()
  from public, anon, authenticated;

create trigger financial_accounts_10_prevent_history_field_changes
before update of opening_balance, currency_code, account_type_code
on public.financial_accounts
for each row execute function public.prevent_account_history_field_changes();

comment on function public.prevent_financial_history_changes() is
  'Rejects UPDATE/DELETE of purchase, lifecycle, valuation and disposal history, except DELETE after the owning auth.users row is gone. No caller-role exemption.';
comment on function public.prevent_posted_account_record_entry_changes() is
  'Locks and checks both source and destination transaction parents. Posted entries cannot be edited, removed or reparented; draft construction and whole-user deletion remain supported.';
comment on function public.prevent_account_history_field_changes() is
  'Preserves opening balance, currency and account type after any financial history, without restricting metadata or existing lifecycle/projection RPCs.';
