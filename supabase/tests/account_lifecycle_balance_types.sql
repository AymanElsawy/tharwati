begin;

\echo 1..6

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '1e000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'lifecycle-owner@example.invalid', '',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '1e000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-8000-000000000000',
    'authenticated', 'authenticated', 'lifecycle-other@example.invalid', '',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.financial_accounts (
  id, user_id, account_type_code, name, currency_code, opening_balance,
  bank_subtype, credit_card_limit, investment_type
)
values
  ('2e000000-0000-4000-8000-000000000001', '1e000000-0000-4000-8000-000000000001', 'cash', 'Cash Zero', 'USD', 0, null, null, null),
  ('2e000000-0000-4000-8000-000000000002', '1e000000-0000-4000-8000-000000000001', 'cash', 'Cash Positive', 'USD', 10, null, null, null),
  ('2e000000-0000-4000-8000-000000000003', '1e000000-0000-4000-8000-000000000001', 'bank', 'Debit Zero', 'USD', 0, 'debit', null, null),
  ('2e000000-0000-4000-8000-000000000004', '1e000000-0000-4000-8000-000000000001', 'bank', 'Debit Positive', 'USD', 10, 'debit', null, null),
  ('2e000000-0000-4000-8000-000000000005', '1e000000-0000-4000-8000-000000000001', 'bank', 'Credit Zero Due', 'USD', 1000, 'credit', 1000, null),
  ('2e000000-0000-4000-8000-000000000006', '1e000000-0000-4000-8000-000000000001', 'bank', 'Credit Positive Due', 'USD', 900, 'credit', 1000, null),
  ('2e000000-0000-4000-8000-000000000007', '1e000000-0000-4000-8000-000000000001', 'brokerage', 'Brokerage Zero', 'USD', 0, null, null, 'stock_etf'),
  ('2e000000-0000-4000-8000-000000000008', '1e000000-0000-4000-8000-000000000001', 'brokerage', 'Brokerage Positive', 'USD', 10, null, null, 'stock_etf'),
  ('2e000000-0000-4000-8000-000000000009', '1e000000-0000-4000-8000-000000000001', 'cash', 'Invalid Cash', 'USD', 0, null, null, null),
  ('2e000000-0000-4000-8000-000000000010', '1e000000-0000-4000-8000-000000000001', 'cash', 'Unavailable Cash', 'USD', 0, null, null, null),
  ('2e000000-0000-4000-8000-000000000011', '1e000000-0000-4000-8000-000000000002', 'cash', 'Other User Cash', 'USD', 0, null, null, null);

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '1e000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

do $test$
declare zero_state record; positive_state record;
begin
  select * into zero_state from public.get_account_lifecycle_eligibility(
    array['2e000000-0000-4000-8000-000000000001'::uuid]
  );
  select * into positive_state from public.get_account_lifecycle_eligibility(
    array['2e000000-0000-4000-8000-000000000002'::uuid]
  );
  if not zero_state.can_close or zero_state.close_block_reason is not null
    or positive_state.can_close or positive_state.close_block_reason <> 'remaining_cash' then
    raise exception 'unexpected Cash lifecycle states';
  end if;
end;
$test$;
\echo ok 1 - Cash zero and positive balances

do $test$
declare zero_state record; positive_state record;
begin
  select * into zero_state from public.get_account_lifecycle_eligibility(
    array['2e000000-0000-4000-8000-000000000003'::uuid]
  );
  select * into positive_state from public.get_account_lifecycle_eligibility(
    array['2e000000-0000-4000-8000-000000000004'::uuid]
  );
  if not zero_state.can_close or zero_state.close_block_reason is not null
    or positive_state.can_close or positive_state.close_block_reason <> 'remaining_cash' then
    raise exception 'unexpected Bank Debit lifecycle states';
  end if;
end;
$test$;
\echo ok 2 - Bank Debit zero and positive balances

do $test$
declare zero_state record; positive_state record;
begin
  select * into zero_state from public.get_account_lifecycle_eligibility(
    array['2e000000-0000-4000-8000-000000000005'::uuid]
  );
  select * into positive_state from public.get_account_lifecycle_eligibility(
    array['2e000000-0000-4000-8000-000000000006'::uuid]
  );
  if not zero_state.can_close or zero_state.close_block_reason is not null
    or positive_state.can_close
    or positive_state.close_block_reason <> 'outstanding_credit_balance' then
    raise exception 'unexpected Bank Credit lifecycle states';
  end if;
end;
$test$;
\echo ok 3 - Bank Credit zero and positive amounts due

do $test$
declare zero_state record; positive_state record;
begin
  select * into zero_state from public.get_account_lifecycle_eligibility(
    array['2e000000-0000-4000-8000-000000000007'::uuid]
  );
  select * into positive_state from public.get_account_lifecycle_eligibility(
    array['2e000000-0000-4000-8000-000000000008'::uuid]
  );
  if not zero_state.can_close or zero_state.close_block_reason is not null
    or positive_state.can_close or positive_state.close_block_reason <> 'remaining_cash' then
    raise exception 'unexpected Brokerage lifecycle states';
  end if;
end;
$test$;
\echo ok 4 - Brokerage zero and positive available cash

reset role;
create or replace function public.get_account_balances(p_account_ids uuid[] default null)
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
    '0'::text,
    case accounts.name
      when 'Invalid Cash' then 'not-a-decimal'::text
      when 'Unavailable Cash' then null::text
      else accounts.opening_balance::text
    end
  from public.financial_accounts as accounts
  where accounts.user_id = auth.uid()
    and (accounts.account_type_code in ('cash', 'bank')
      or (accounts.account_type_code = 'brokerage' and accounts.is_active))
    and (p_account_ids is null or accounts.id = any(p_account_ids));
$$;
set local role authenticated;

do $test$
declare invalid_state record; unavailable_state record;
begin
  select * into invalid_state from public.get_account_lifecycle_eligibility(
    array['2e000000-0000-4000-8000-000000000009'::uuid]
  );
  select * into unavailable_state from public.get_account_lifecycle_eligibility(
    array['2e000000-0000-4000-8000-000000000010'::uuid]
  );
  if invalid_state.can_close
    or invalid_state.close_block_reason <> 'current_value_unavailable'
    or unavailable_state.can_close
    or unavailable_state.close_block_reason <> 'current_value_unavailable' then
    raise exception 'invalid or unavailable balance did not fail closed';
  end if;
end;
$test$;
\echo ok 5 - invalid and unavailable text balances fail closed

do $test$
declare visible_count integer;
begin
  select count(*) into visible_count
  from public.get_account_lifecycle_eligibility(
    array[
      '2e000000-0000-4000-8000-000000000001'::uuid,
      '2e000000-0000-4000-8000-000000000011'::uuid
    ]
  );
  if visible_count <> 1 then
    raise exception 'lifecycle eligibility exposed another user account';
  end if;
end;
$test$;
\echo ok 6 - authenticated lifecycle results are isolated to the caller

rollback;
