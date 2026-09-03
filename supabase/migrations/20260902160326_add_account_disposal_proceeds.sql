-- Atomically allocate Real Estate and Business sale proceeds into an owned
-- same-currency Cash or Bank account without classifying them as income.

insert into public.transaction_types (code, name, is_active)
values ('account_disposal_proceeds', 'Account disposal proceeds', true)
on conflict (code) do update set name = excluded.name, is_active = true;

alter table public.account_disposals
  add column idempotency_key uuid,
  add column proceeds_account_id uuid references public.financial_accounts (id) on delete restrict,
  add column proceeds_transaction_id uuid references public.financial_transactions (id) on delete restrict,
  add constraint account_disposals_proceeds_transaction_unique unique (proceeds_transaction_id),
  add constraint account_disposals_proceeds_link_pair_check check (
    (proceeds_account_id is null) = (proceeds_transaction_id is null)
  );

create unique index account_disposals_user_idempotency_key_idx
  on public.account_disposals (user_id, idempotency_key)
  where idempotency_key is not null;

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
        'account_disposal_proceeds'
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

  if v_transaction_type in ('income', 'expense', 'transfer', 'account_disposal_proceeds') then
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
  end if;

  return new;
end;
$$;

create function public.prevent_account_disposal_proceeds_link_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.proceeds_account_id is distinct from old.proceeds_account_id
    or new.proceeds_transaction_id is distinct from old.proceeds_transaction_id then
    raise exception 'account disposal proceeds association is immutable'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger account_disposals_prevent_proceeds_link_changes
before update of proceeds_account_id, proceeds_transaction_id
on public.account_disposals
for each row execute function public.prevent_account_disposal_proceeds_link_changes();

create function public.post_account_disposal_proceeds_internal(
  p_disposal_id uuid,
  p_source_account_type text,
  p_destination_account_id uuid,
  p_sale_amount numeric,
  p_sale_currency_code text,
  p_disposed_on date,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_destination public.financial_accounts%rowtype;
  v_transaction public.financial_transactions%rowtype;
  v_destination_balance numeric;
begin
  if v_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  if p_disposal_id is null or p_sale_amount is null or p_sale_amount <= 0
    or p_sale_currency_code not in ('USD', 'SAR', 'EGP', 'EUR', 'GBP')
    or p_disposed_on is null then
    raise exception 'Valid disposal proceeds fields are required' using errcode = '23514';
  end if;

  select * into v_destination
  from public.financial_accounts
  where id = p_destination_account_id
    and user_id = v_user_id
    and is_active
    and account_type_code in ('cash', 'bank')
  for update;
  if not found then
    raise exception 'An active owned Cash or Bank destination account is required'
      using errcode = '42501';
  end if;
  if v_destination.currency_code <> p_sale_currency_code then
    raise exception 'Destination account currency must match sale currency'
      using errcode = '23514';
  end if;

  if v_destination.account_type_code = 'bank' and v_destination.bank_subtype = 'credit' then
    select v_destination.opening_balance + coalesce(sum(
      case entries.entry_side
        when 'debit' then entries.account_amount
        when 'credit' then -entries.account_amount
      end
    ) filter (where transactions.status = 'posted'), 0)
    into v_destination_balance
    from public.transaction_entries entries
    join public.financial_transactions transactions
      on transactions.id = entries.transaction_id
    where entries.account_id = v_destination.id and entries.asset_id is null;

    if v_destination.credit_card_limit is null
      or v_destination_balance + p_sale_amount > v_destination.credit_card_limit then
      raise exception 'Destination available credit would exceed its credit limit'
        using errcode = '23514';
    end if;
  end if;

  insert into public.financial_transactions (
    user_id, transaction_type_code, transaction_currency_code, status,
    occurred_at, description, external_reference, notes
  ) values (
    v_user_id,
    'account_disposal_proceeds',
    p_sale_currency_code,
    'draft',
    p_disposed_on::timestamp at time zone 'UTC',
    case p_source_account_type
      when 'real_estate' then 'Real Estate sale proceeds'
      else 'Business sale proceeds'
    end,
    'account_disposal:' || p_disposal_id::text,
    nullif(btrim(p_notes), '')
  ) returning * into v_transaction;

  insert into public.transaction_entries (
    transaction_id, user_id, account_id, entry_side,
    transaction_amount, account_amount, memo
  ) values
    (v_transaction.id, v_user_id, v_destination.id, 'debit',
      p_sale_amount, p_sale_amount, 'account_disposal_proceeds_received'),
    (v_transaction.id, v_user_id, null, 'credit',
      p_sale_amount, p_sale_amount, 'account_disposal_proceeds');

  select * into v_transaction from public.post_transaction(v_transaction.id);
  return v_transaction.id;
end;
$$;

drop function public.get_account_disposals(uuid[]);
create function public.get_account_disposals(p_account_ids uuid[] default null)
returns table (
  id uuid, user_id uuid, account_id uuid, disposed_on date, sale_amount numeric,
  sale_currency_code text, ownership_percentage_sold numeric, notes text,
  corrects_disposal_id uuid, idempotency_key uuid, proceeds_account_id uuid,
  proceeds_transaction_id uuid, created_at timestamptz, is_effective boolean
)
language sql security invoker set search_path = '' stable
as $$
  select disposal.id, disposal.user_id, disposal.account_id, disposal.disposed_on,
    disposal.sale_amount, disposal.sale_currency_code, disposal.ownership_percentage_sold,
    disposal.notes, disposal.corrects_disposal_id, disposal.idempotency_key,
    disposal.proceeds_account_id,
    disposal.proceeds_transaction_id, disposal.created_at,
    not exists (
      select 1 from public.account_disposals correction
      where correction.corrects_disposal_id = disposal.id
    )
  from public.account_disposals disposal
  join public.financial_accounts account on account.id = disposal.account_id
  where disposal.user_id = (select auth.uid())
    and account.user_id = (select auth.uid())
    and (p_account_ids is null or disposal.account_id = any(p_account_ids))
  order by disposal.account_id, disposal.disposed_on desc, disposal.created_at desc;
$$;

drop function public.add_account_disposal(uuid, date, numeric, text, numeric, text);
create function public.add_account_disposal(
  p_account_id uuid,
  p_disposed_on date,
  p_sale_amount numeric,
  p_sale_currency_code text,
  p_ownership_percentage_sold numeric,
  p_idempotency_key uuid,
  p_notes text default null,
  p_destination_account_id uuid default null
)
returns public.account_disposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_account public.financial_accounts%rowtype;
  v_existing public.account_disposals%rowtype;
  v_row public.account_disposals;
  v_disposal_id uuid := gen_random_uuid();
  v_proceeds_transaction_id uuid;
  v_sale_amount numeric(20, 2);
  v_ownership_percentage_sold numeric(5, 2);
  v_notes text;
  v_expected_destination_account_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  if p_idempotency_key is null then
    raise exception 'An idempotency key is required' using errcode = '23514';
  end if;
  if p_sale_amount is null
    or lower(p_sale_amount::text) in ('nan', 'infinity', '-infinity')
    or p_sale_amount < 0
    or p_sale_amount >= 1000000000000000000::numeric
    or p_sale_amount <> trunc(p_sale_amount, 2) then
    raise exception 'Sale amount must be finite, non-negative, and have at most 2 decimal places'
      using errcode = '23514';
  end if;
  v_sale_amount := p_sale_amount;
  if p_disposed_on is null or p_disposed_on > current_date
    or p_sale_currency_code not in ('USD', 'SAR', 'EGP', 'EUR', 'GBP')
    or p_ownership_percentage_sold is null
    or p_ownership_percentage_sold <= 0 or p_ownership_percentage_sold > 100 then
    raise exception 'Valid non-future disposal fields are required'
      using errcode = '23514';
  end if;
  v_ownership_percentage_sold := p_ownership_percentage_sold;
  v_notes := nullif(btrim(p_notes), '');
  v_expected_destination_account_id := case
    when v_sale_amount > 0 then p_destination_account_id
    else null
  end;
  if v_sale_amount > 0 and p_destination_account_id is null then
    raise exception 'A destination account is required for positive sale proceeds'
      using errcode = '23514';
  end if;
  if v_sale_amount = 0 and p_destination_account_id is not null then
    raise exception 'A zero-proceeds disposal cannot have a destination account'
      using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    v_user_id::text || ':' || p_idempotency_key::text,
    0
  ));

  select * into v_existing
  from public.account_disposals
  where user_id = v_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.account_id = p_account_id
      and v_existing.disposed_on = p_disposed_on
      and v_existing.sale_amount = v_sale_amount
      and v_existing.sale_currency_code = p_sale_currency_code
      and v_existing.ownership_percentage_sold = v_ownership_percentage_sold
      and v_existing.notes is not distinct from v_notes
      and v_existing.proceeds_account_id is not distinct from v_expected_destination_account_id then
      return v_existing;
    end if;
    raise exception 'Idempotency key was already used with different disposal data'
      using errcode = '23514';
  end if;

  select * into v_account
  from public.financial_accounts
  where id = p_account_id and user_id = v_user_id and is_active
  for update;
  if not found or v_account.account_type_code not in ('real_estate', 'business') then
    raise exception 'An active owned Real Estate or Business account is required'
      using errcode = '23514';
  end if;
  if v_sale_amount > 0 then
    v_proceeds_transaction_id := public.post_account_disposal_proceeds_internal(
      v_disposal_id, v_account.account_type_code, p_destination_account_id,
      v_sale_amount, p_sale_currency_code, p_disposed_on, v_notes
    );
  end if;

  insert into public.account_disposals (
    id, user_id, account_id, disposed_on, sale_amount, sale_currency_code,
    ownership_percentage_sold, notes, idempotency_key,
    proceeds_account_id, proceeds_transaction_id
  ) values (
    v_disposal_id, v_user_id, p_account_id, p_disposed_on, v_sale_amount,
    p_sale_currency_code, v_ownership_percentage_sold, v_notes,
    p_idempotency_key, v_expected_destination_account_id,
    v_proceeds_transaction_id
  ) returning * into v_row;

  perform public.recalculate_account_disposal_projection(p_account_id);
  return v_row;
end;
$$;

drop function public.correct_account_disposal(uuid, date, numeric, text, numeric, text);
create function public.correct_account_disposal(
  p_disposal_id uuid,
  p_disposed_on date,
  p_sale_amount numeric,
  p_sale_currency_code text,
  p_ownership_percentage_sold numeric,
  p_notes text default null,
  p_destination_account_id uuid default null
)
returns public.account_disposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_original public.account_disposals%rowtype;
  v_account public.financial_accounts%rowtype;
  v_row public.account_disposals;
  v_replacement_id uuid := gen_random_uuid();
  v_proceeds_transaction_id uuid;
  v_sale_amount numeric(20, 2);
  v_ownership_percentage_sold numeric(5, 2);
begin
  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  if p_sale_amount is null
    or lower(p_sale_amount::text) in ('nan', 'infinity', '-infinity')
    or p_sale_amount < 0
    or p_sale_amount >= 1000000000000000000::numeric
    or p_sale_amount <> trunc(p_sale_amount, 2) then
    raise exception 'Sale amount must be finite, non-negative, and have at most 2 decimal places'
      using errcode = '23514';
  end if;
  v_sale_amount := p_sale_amount;

  select * into v_original
  from public.account_disposals
  where id = p_disposal_id and user_id = auth.uid()
  for update;
  if not found or exists (
    select 1 from public.account_disposals
    where corrects_disposal_id = p_disposal_id
  ) then
    raise exception 'Only an effective owned disposal can be corrected'
      using errcode = '23514';
  end if;
  if v_original.proceeds_transaction_id is not null then
    raise exception 'account_disposal_correction_blocked:allocated_proceeds'
      using errcode = '23514';
  end if;

  select * into v_account
  from public.financial_accounts
  where id = v_original.account_id and user_id = auth.uid()
  for update;
  if not found or v_account.account_type_code not in ('real_estate', 'business') then
    raise exception 'A supported owned account is required' using errcode = '23514';
  end if;
  if p_disposed_on is null or p_disposed_on > current_date
    or p_sale_amount is null
    or p_sale_currency_code not in ('USD', 'SAR', 'EGP', 'EUR', 'GBP')
    or p_ownership_percentage_sold is null
    or p_ownership_percentage_sold <= 0 or p_ownership_percentage_sold > 100 then
    raise exception 'Valid non-future disposal fields are required'
      using errcode = '23514';
  end if;
  v_ownership_percentage_sold := p_ownership_percentage_sold;
  if v_sale_amount > 0 and p_destination_account_id is null then
    raise exception 'A destination account is required for positive sale proceeds'
      using errcode = '23514';
  end if;
  if v_sale_amount = 0 and p_destination_account_id is not null then
    raise exception 'A zero-proceeds disposal cannot have a destination account'
      using errcode = '23514';
  end if;

  if v_sale_amount > 0 then
    v_proceeds_transaction_id := public.post_account_disposal_proceeds_internal(
      v_replacement_id, v_account.account_type_code, p_destination_account_id,
      v_sale_amount, p_sale_currency_code, p_disposed_on, p_notes
    );
  end if;

  insert into public.account_disposals (
    id, user_id, account_id, disposed_on, sale_amount, sale_currency_code,
    ownership_percentage_sold, notes, corrects_disposal_id,
    proceeds_account_id, proceeds_transaction_id
  ) values (
    v_replacement_id, auth.uid(), v_original.account_id, p_disposed_on,
    v_sale_amount, p_sale_currency_code, v_ownership_percentage_sold,
    nullif(btrim(p_notes), ''), p_disposal_id,
    case when v_sale_amount > 0 then p_destination_account_id else null end,
    v_proceeds_transaction_id
  ) returning * into v_row;

  perform public.recalculate_account_disposal_projection(v_original.account_id);
  return v_row;
end;
$$;

revoke all on function public.prevent_account_disposal_proceeds_link_changes()
  from public, anon, authenticated;
revoke all on function public.post_account_disposal_proceeds_internal(
  uuid, text, uuid, numeric, text, date, text
) from public, anon, authenticated;
revoke all on function public.get_account_disposals(uuid[]) from public, anon;
revoke all on function public.add_account_disposal(
  uuid, date, numeric, text, numeric, uuid, text, uuid
) from public, anon;
revoke all on function public.correct_account_disposal(
  uuid, date, numeric, text, numeric, text, uuid
) from public, anon;

grant execute on function public.get_account_disposals(uuid[]) to authenticated;
grant execute on function public.add_account_disposal(
  uuid, date, numeric, text, numeric, uuid, text, uuid
) to authenticated;
grant execute on function public.correct_account_disposal(
  uuid, date, numeric, text, numeric, text, uuid
) to authenticated;

comment on function public.post_account_disposal_proceeds_internal(
  uuid, text, uuid, numeric, text, date, text
) is 'Internal atomic poster for same-currency Real Estate and Business disposal proceeds. Uses a dedicated immutable ledger classification and never records ordinary income or owner contribution.';

comment on function public.add_account_disposal(
  uuid, date, numeric, text, numeric, uuid, text, uuid
) is 'Idempotently adds an owned Real Estate or Business disposal and atomically posts canonical positive proceeds to an active owned same-currency Cash or Bank account. Zero proceeds require no destination.';

comment on function public.correct_account_disposal(
  uuid, date, numeric, text, numeric, text, uuid
) is 'Corrects an effective disposal only when it has no allocated proceeds. V1 blocks allocated-proceeds corrections until atomic reversal semantics exist.';
