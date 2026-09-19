-- Refund V1: append-only, expense-linked refunds with dedicated cancellation.

insert into public.transaction_types (code, name, is_active)
values
  ('refund', 'Refund', true),
  ('refund_cancellation', 'Refund cancellation', true)
on conflict (code) do update set name = excluded.name, is_active = true;

drop policy if exists account_record_transaction_types_select on public.transaction_types;
create policy account_record_transaction_types_select on public.transaction_types
  for select to authenticated
  using (code in ('income', 'expense', 'transfer', 'refund') and is_active);

alter table public.financial_transactions
  add column refunds_transaction_id uuid
    references public.financial_transactions (id) on delete restrict,
  add column refund_idempotency_key uuid,
  add constraint financial_transactions_refund_contract_check check (
    (
      transaction_type_code = 'refund'
      and refunds_transaction_id is not null
      and refund_idempotency_key is not null
      and reverses_transaction_id is null
      and corrects_transaction_id is null
    )
    or (
      transaction_type_code = 'refund_cancellation'
      and refunds_transaction_id is null
      and refund_idempotency_key is not null
      and reverses_transaction_id is not null
      and corrects_transaction_id is null
    )
    or (
      transaction_type_code not in ('refund', 'refund_cancellation')
      and refunds_transaction_id is null
      and refund_idempotency_key is null
    )
  );

create index financial_transactions_refunds_transaction_id_idx
  on public.financial_transactions (refunds_transaction_id)
  where refunds_transaction_id is not null;

create unique index financial_transactions_user_refund_idempotency_key_idx
  on public.financial_transactions (user_id, refund_idempotency_key)
  where refund_idempotency_key is not null;

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
        'metal_purchase_funding_reversal',
        'existing_holding_opening_equity',
        'existing_holding_opening_equity_reversal',
        'account_disposal_proceeds',
        'expense_refund',
        'expense_refund_cancellation'
      )
      and asset_id is null
      and quantity_delta is null
      and unit_price is null
      and purity is null
    )
  );

create or replace function public.validate_account_record_entry_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transaction_type text;
begin
  select transaction_type_code into v_transaction_type
  from public.financial_transactions
  where id = new.transaction_id and user_id = new.user_id;

  if not found then
    raise exception 'transaction entry does not belong to its transaction owner'
      using errcode = '23514';
  end if;

  if v_transaction_type in (
    'income', 'expense', 'transfer', 'account_disposal_proceeds',
    'refund', 'refund_cancellation'
  ) then
    if new.account_id is not null and not exists (
      select 1
      from public.financial_accounts as accounts
      where accounts.id = new.account_id
        and accounts.user_id = new.user_id
        and (
          accounts.account_type_code in ('cash', 'bank')
          or (
            v_transaction_type = 'transfer'
            and accounts.account_type_code = 'brokerage'
            and new.memo in (
              'brokerage_cash_transfer_sent',
              'brokerage_cash_transfer_received'
            )
          )
        )
    ) then
      raise exception 'transaction entry account is not supported by this record flow'
        using errcode = '23514';
    end if;

    if new.asset_id is not null or new.quantity_delta is not null
      or new.unit_price is not null or new.purity is not null then
      raise exception 'account records cannot contain asset or quantity effects'
        using errcode = '23514';
    end if;

    if v_transaction_type = 'account_disposal_proceeds' and (
      (new.account_id is null and (new.entry_side <> 'credit' or new.memo <> 'account_disposal_proceeds'))
      or (new.account_id is not null and (new.entry_side <> 'debit' or new.memo <> 'account_disposal_proceeds_received'))
    ) then
      raise exception 'invalid account disposal proceeds entry'
        using errcode = '23514';
    end if;

    if v_transaction_type = 'refund' and (
      (new.account_id is null and (new.entry_side <> 'credit' or new.memo <> 'expense_refund'))
      or (new.account_id is not null and (new.entry_side <> 'debit' or new.memo <> 'expense_refund_received'))
    ) then
      raise exception 'invalid expense refund entry' using errcode = '23514';
    end if;

    if v_transaction_type = 'refund_cancellation' and (
      (new.account_id is null and (new.entry_side <> 'debit' or new.memo <> 'expense_refund_cancellation'))
      or (new.account_id is not null and (new.entry_side <> 'credit' or new.memo <> 'expense_refund_cancellation_sent'))
    ) then
      raise exception 'invalid expense refund cancellation entry' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create function public.prevent_expense_mutation_with_effective_refunds()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_original_id uuid := coalesce(new.reverses_transaction_id, new.corrects_transaction_id);
begin
  if v_original_id is not null
    and exists (
      select 1
      from public.financial_transactions original
      where original.id = v_original_id
        and original.transaction_type_code = 'expense'
    )
    and exists (
      select 1
      from public.financial_transactions refund
      where refund.refunds_transaction_id = v_original_id
        and refund.transaction_type_code = 'refund'
        and refund.status = 'posted'
        and not exists (
          select 1
          from public.financial_transactions cancellation
          where cancellation.reverses_transaction_id = refund.id
            and cancellation.transaction_type_code = 'refund_cancellation'
            and cancellation.status = 'posted'
        )
    ) then
    raise exception 'expense with effective refunds cannot be reversed or corrected'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger financial_transactions_block_refunded_expense_mutation
before insert on public.financial_transactions
for each row
when (new.reverses_transaction_id is not null or new.corrects_transaction_id is not null)
execute function public.prevent_expense_mutation_with_effective_refunds();

create function public.add_expense_refund(
  p_expense_transaction_id uuid,
  p_amount numeric,
  p_occurred_at timestamptz,
  p_idempotency_key uuid,
  p_destination_account_id uuid default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_expense public.financial_transactions%rowtype;
  v_existing public.financial_transactions%rowtype;
  v_original_account public.financial_accounts%rowtype;
  v_destination public.financial_accounts%rowtype;
  v_transaction public.financial_transactions%rowtype;
  v_original_amount numeric;
  v_effective_refunded numeric;
  v_destination_balance numeric;
  v_destination_account_id uuid;
  v_notes text := nullif(btrim(p_notes), '');
  v_existing_amount numeric;
  v_existing_destination_id uuid;
  v_entry_count integer;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_idempotency_key is null then
    raise exception 'refund idempotency key is required' using errcode = '23514';
  end if;
  if p_amount is null
    or lower(p_amount::text) in ('nan', 'infinity', '-infinity')
    or p_amount <= 0
    or p_amount >= 100000000000000000000::numeric
    or p_amount <> trunc(p_amount, 10) then
    raise exception 'refund amount must be finite, positive, and have at most 10 decimal places'
      using errcode = '23514';
  end if;
  if p_occurred_at is null then
    raise exception 'refund date and time are required' using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    v_user_id::text || ':' || p_idempotency_key::text,
    0
  ));

  select entry.account_id into v_destination_account_id
  from public.financial_transactions expense
  join public.transaction_entries entry
    on entry.transaction_id = expense.id
   and entry.account_id is not null
   and entry.entry_side = 'credit'
  where expense.id = p_expense_transaction_id
    and expense.user_id = v_user_id
    and expense.transaction_type_code = 'expense';
  v_destination_account_id := coalesce(p_destination_account_id, v_destination_account_id);

  select * into v_existing
  from public.financial_transactions
  where user_id = v_user_id
    and refund_idempotency_key = p_idempotency_key;

  if found then
    if v_existing.transaction_type_code <> 'refund' then
      raise exception 'refund idempotency key was already used by another operation'
        using errcode = '23505';
    end if;

    select e.account_id, e.account_amount
    into v_existing_destination_id, v_existing_amount
    from public.transaction_entries e
    where e.transaction_id = v_existing.id
      and e.account_id is not null
      and e.entry_side = 'debit'
      and e.memo = 'expense_refund_received';

    if v_existing.refunds_transaction_id = p_expense_transaction_id
      and v_existing.occurred_at = p_occurred_at
      and v_existing.notes is not distinct from v_notes
      and v_existing_amount = p_amount
      and v_existing_destination_id = v_destination_account_id then
      return jsonb_build_object('transaction', to_jsonb(v_existing), 'idempotent', true);
    end if;
    raise exception 'refund idempotency key was already used with different refund data'
      using errcode = '23505';
  end if;

  select * into v_expense
  from public.financial_transactions
  where id = p_expense_transaction_id
    and user_id = v_user_id
    and transaction_type_code = 'expense'
    and status = 'posted'
    and reverses_transaction_id is null
  for update;

  if not found
    or exists (
      select 1 from public.financial_transactions reversal
      where reversal.reverses_transaction_id = p_expense_transaction_id
        and reversal.status = 'posted'
    )
    or exists (
      select 1 from public.financial_transactions replacement
      where replacement.corrects_transaction_id = p_expense_transaction_id
        and replacement.status = 'posted'
    ) then
    raise exception 'effective posted expense is not available for refund'
      using errcode = 'P0002';
  end if;

  select count(*)
  into v_entry_count
  from public.transaction_entries e
  where e.transaction_id = v_expense.id;

  select account.* into v_original_account
  from public.financial_accounts account
  join public.transaction_entries entry on entry.account_id = account.id
  where entry.transaction_id = v_expense.id
    and entry.entry_side = 'credit'
    and entry.memo <> 'owner_draw'
    and account.user_id = v_user_id
    and account.account_type_code in ('cash', 'bank');

  select entry.account_amount into v_original_amount
  from public.transaction_entries entry
  where entry.transaction_id = v_expense.id
    and entry.account_id = v_original_account.id
    and entry.entry_side = 'credit';

  if v_entry_count <> 2 or not found or not exists (
    select 1
    from public.transaction_entries entry
    where entry.transaction_id = v_expense.id
      and entry.account_id is null
      and entry.entry_side = 'debit'
      and entry.memo = 'owner_draw'
      and entry.transaction_amount = v_original_amount
      and entry.account_amount = v_original_amount
  ) then
    raise exception 'transaction is not a supported expense record' using errcode = '22023';
  end if;

  v_destination_account_id := coalesce(p_destination_account_id, v_original_account.id);

  select * into v_destination
  from public.financial_accounts
  where id = v_destination_account_id
    and user_id = v_user_id
    and is_active
    and account_type_code in ('cash', 'bank')
  for update;
  if not found then
    raise exception 'refund destination account is not available' using errcode = '42501';
  end if;
  if v_destination.currency_code <> v_expense.transaction_currency_code
    or v_destination.currency_code <> v_original_account.currency_code then
    raise exception 'refund destination must use the expense currency'
      using errcode = '23514';
  end if;

  select coalesce(sum(refund_entry.account_amount), 0)
  into v_effective_refunded
  from public.financial_transactions refund
  join public.transaction_entries refund_entry
    on refund_entry.transaction_id = refund.id
   and refund_entry.account_id is not null
   and refund_entry.entry_side = 'debit'
   and refund_entry.memo = 'expense_refund_received'
  where refund.refunds_transaction_id = v_expense.id
    and refund.user_id = v_user_id
    and refund.transaction_type_code = 'refund'
    and refund.status = 'posted'
    and not exists (
      select 1
      from public.financial_transactions cancellation
      where cancellation.reverses_transaction_id = refund.id
        and cancellation.transaction_type_code = 'refund_cancellation'
        and cancellation.status = 'posted'
    );

  if v_effective_refunded + p_amount > v_original_amount then
    raise exception 'refund total would exceed original expense amount'
      using errcode = '23514';
  end if;

  select v_destination.opening_balance + coalesce(sum(
    case entry.entry_side when 'debit' then entry.account_amount else -entry.account_amount end
  ) filter (where transaction.status = 'posted'), 0)
  into v_destination_balance
  from public.transaction_entries entry
  join public.financial_transactions transaction on transaction.id = entry.transaction_id
  where entry.account_id = v_destination.id and entry.asset_id is null;

  if v_destination.account_type_code = 'bank' and v_destination.bank_subtype = 'credit' then
    if v_destination.credit_card_limit is null then
      raise exception 'credit account requires a credit card limit before available credit can increase'
        using errcode = '23514';
    end if;
    if v_destination_balance + p_amount > v_destination.credit_card_limit then
      raise exception 'available credit would exceed its credit limit' using errcode = '23514';
    end if;
  end if;

  insert into public.financial_transactions (
    user_id, transaction_type_code, transaction_currency_code, status,
    occurred_at, description, notes, main_category_id, subcategory_id,
    refunds_transaction_id, refund_idempotency_key
  ) values (
    v_user_id, 'refund', v_expense.transaction_currency_code, 'draft',
    p_occurred_at, 'Refund: ' || v_expense.description, v_notes,
    v_expense.main_category_id, v_expense.subcategory_id,
    v_expense.id, p_idempotency_key
  ) returning * into v_transaction;

  insert into public.transaction_entries (
    transaction_id, user_id, account_id, entry_side,
    transaction_amount, account_amount, memo
  ) values (
    v_transaction.id, v_user_id, v_destination.id, 'debit',
    p_amount, p_amount, 'expense_refund_received'
  ), (
    v_transaction.id, v_user_id, null, 'credit',
    p_amount, p_amount, 'expense_refund'
  );

  select * into v_transaction from public.post_transaction(v_transaction.id);
  return jsonb_build_object('transaction', to_jsonb(v_transaction), 'idempotent', false);
end;
$$;

create function public.cancel_expense_refund(
  p_refund_transaction_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_refund public.financial_transactions%rowtype;
  v_existing public.financial_transactions%rowtype;
  v_destination public.financial_accounts%rowtype;
  v_transaction public.financial_transactions%rowtype;
  v_amount numeric;
  v_destination_balance numeric;
  v_entry_count integer;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_idempotency_key is null then
    raise exception 'refund cancellation idempotency key is required' using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    v_user_id::text || ':' || p_idempotency_key::text,
    0
  ));

  select * into v_existing
  from public.financial_transactions
  where user_id = v_user_id
    and refund_idempotency_key = p_idempotency_key;
  if found then
    if v_existing.transaction_type_code = 'refund_cancellation'
      and v_existing.reverses_transaction_id = p_refund_transaction_id then
      return jsonb_build_object('transaction', to_jsonb(v_existing), 'idempotent', true);
    end if;
    raise exception 'refund cancellation idempotency key was already used with different data'
      using errcode = '23505';
  end if;

  select * into v_refund
  from public.financial_transactions
  where id = p_refund_transaction_id
    and user_id = v_user_id
    and transaction_type_code = 'refund'
    and status = 'posted'
  for update;
  if not found then
    raise exception 'posted refund is not available for cancellation' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.financial_transactions cancellation
    where cancellation.reverses_transaction_id = v_refund.id
  ) then
    raise exception 'refund has already been cancelled' using errcode = '23505';
  end if;

  perform 1
  from public.financial_transactions expense
  where expense.id = v_refund.refunds_transaction_id
    and expense.user_id = v_user_id
    and expense.transaction_type_code = 'expense'
  for update;
  if not found then
    raise exception 'linked expense is not available' using errcode = 'P0002';
  end if;

  select count(*) into v_entry_count
  from public.transaction_entries entry
  where entry.transaction_id = v_refund.id;

  select account.* into v_destination
  from public.transaction_entries entry
  join public.financial_accounts account on account.id = entry.account_id
  where entry.transaction_id = v_refund.id
    and entry.entry_side = 'debit'
    and entry.memo = 'expense_refund_received'
    and account.user_id = v_user_id
    and account.account_type_code in ('cash', 'bank');

  select entry.account_amount into v_amount
  from public.transaction_entries entry
  where entry.transaction_id = v_refund.id
    and entry.account_id = v_destination.id
    and entry.entry_side = 'debit'
    and entry.memo = 'expense_refund_received';

  if v_entry_count <> 2 or v_destination.id is null or not exists (
    select 1 from public.transaction_entries entry
    where entry.transaction_id = v_refund.id
      and entry.account_id is null
      and entry.entry_side = 'credit'
      and entry.memo = 'expense_refund'
      and entry.account_amount = v_amount
  ) then
    raise exception 'transaction is not a supported refund record' using errcode = '22023';
  end if;

  select * into v_destination
  from public.financial_accounts
  where id = v_destination.id and user_id = v_user_id
  for update;

  select v_destination.opening_balance + coalesce(sum(
    case entry.entry_side when 'debit' then entry.account_amount else -entry.account_amount end
  ) filter (where transaction.status = 'posted'), 0)
  into v_destination_balance
  from public.transaction_entries entry
  join public.financial_transactions transaction on transaction.id = entry.transaction_id
  where entry.account_id = v_destination.id and entry.asset_id is null;

  if v_destination_balance < v_amount then
    raise exception 'insufficient available balance to cancel refund' using errcode = 'P0002';
  end if;

  insert into public.financial_transactions (
    user_id, transaction_type_code, transaction_currency_code, status,
    occurred_at, description, notes, main_category_id, subcategory_id,
    reverses_transaction_id, refund_idempotency_key
  ) values (
    v_user_id, 'refund_cancellation', v_refund.transaction_currency_code, 'draft',
    now(), 'Refund cancellation', 'Cancellation of ' || v_refund.id,
    v_refund.main_category_id, v_refund.subcategory_id,
    v_refund.id, p_idempotency_key
  ) returning * into v_transaction;

  insert into public.transaction_entries (
    transaction_id, user_id, account_id, entry_side,
    transaction_amount, account_amount, memo
  ) values (
    v_transaction.id, v_user_id, null, 'debit',
    v_amount, v_amount, 'expense_refund_cancellation'
  ), (
    v_transaction.id, v_user_id, v_destination.id, 'credit',
    v_amount, v_amount, 'expense_refund_cancellation_sent'
  );

  select * into v_transaction from public.post_transaction(v_transaction.id);
  return jsonb_build_object('transaction', to_jsonb(v_transaction), 'idempotent', false);
end;
$$;

create function public.get_expense_refund_summary(
  p_expense_transaction_id uuid
)
returns table (
  expense_transaction_id uuid,
  original_amount text,
  effective_refunded_amount text,
  remaining_refundable_amount text,
  currency_code text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_original_amount numeric;
  v_refunded numeric;
  v_currency_code text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select entry.account_amount, transaction.transaction_currency_code
  into v_original_amount, v_currency_code
  from public.financial_transactions transaction
  join public.transaction_entries entry
    on entry.transaction_id = transaction.id
   and entry.account_id is not null
   and entry.entry_side = 'credit'
  where transaction.id = p_expense_transaction_id
    and transaction.user_id = v_user_id
    and transaction.transaction_type_code = 'expense'
    and transaction.status = 'posted';

  if not found then
    raise exception 'posted expense is not available' using errcode = 'P0002';
  end if;

  select coalesce(sum(entry.account_amount), 0)
  into v_refunded
  from public.financial_transactions refund
  join public.transaction_entries entry
    on entry.transaction_id = refund.id
   and entry.account_id is not null
   and entry.entry_side = 'debit'
   and entry.memo = 'expense_refund_received'
  where refund.refunds_transaction_id = p_expense_transaction_id
    and refund.user_id = v_user_id
    and refund.transaction_type_code = 'refund'
    and refund.status = 'posted'
    and not exists (
      select 1
      from public.financial_transactions cancellation
      where cancellation.reverses_transaction_id = refund.id
        and cancellation.transaction_type_code = 'refund_cancellation'
        and cancellation.status = 'posted'
    );

  return query select
    p_expense_transaction_id,
    v_original_amount::text,
    v_refunded::text,
    (v_original_amount - v_refunded)::text,
    v_currency_code;
end;
$$;

-- Extended history accepts Refund as a filter. Existing effective-history rules
-- already hide every reversal row and any original it reverses, so a cancelled
-- Refund and its compensating transaction are both absent from normal history.
do $$
declare
  v_oid regprocedure := 'public.get_account_record_history(uuid,timestamptz,uuid,integer,text,text,date,date,text,uuid,uuid,numeric,numeric)'::regprocedure;
  v_definition text;
begin
  v_definition := pg_catalog.pg_get_functiondef(v_oid);
  if pg_catalog.strpos(
    v_definition,
    'p_record_type not in (''income'', ''expense'', ''transfer'')'
  ) = 0 then
    raise exception 'expected Account Record history type validation was not found';
  end if;
  v_definition := pg_catalog.replace(
    v_definition,
    'p_record_type not in (''income'', ''expense'', ''transfer'')',
    'p_record_type not in (''income'', ''expense'', ''transfer'', ''refund'')'
  );
  execute v_definition;
end;
$$;

alter table public.record_categories
  drop constraint record_categories_system_ownership_check;
alter table public.record_categories
  add constraint record_categories_system_ownership_check check (
    (user_id is null and system_code is not null)
    or (user_id is not null and system_code is null)
  );
update public.record_categories
set is_archived = true
where system_code = 'income.refunds';

revoke all on function public.prevent_expense_mutation_with_effective_refunds() from public, anon, authenticated;
revoke all on function public.add_expense_refund(uuid, numeric, timestamptz, uuid, uuid, text) from public, anon;
grant execute on function public.add_expense_refund(uuid, numeric, timestamptz, uuid, uuid, text) to authenticated;
revoke all on function public.cancel_expense_refund(uuid, uuid) from public, anon;
grant execute on function public.cancel_expense_refund(uuid, uuid) to authenticated;
revoke all on function public.get_expense_refund_summary(uuid) from public, anon;
grant execute on function public.get_expense_refund_summary(uuid) to authenticated;

comment on function public.add_expense_refund(uuid, numeric, timestamptz, uuid, uuid, text) is
  'Posts an idempotent partial or full same-currency Refund linked to one effective owned Expense.';
comment on function public.cancel_expense_refund(uuid, uuid) is
  'Posts an idempotent audit-only exact cancellation for one owned effective Refund.';
comment on function public.get_expense_refund_summary(uuid) is
  'Returns original, effective refunded, and remaining refundable amounts for one owned Expense.';
