begin;

\echo 1..8

create or replace function pg_temp.expect_name_conflict(p_statement text)
returns void
language plpgsql
as $$
begin
  execute p_statement;
  raise exception 'statement unexpectedly succeeded';
exception
  when unique_violation then
    if position('financial_accounts_non_metal_user_name_lower_key' in sqlerrm) = 0 then
      raise;
    end if;
end;
$$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '1c000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'active-name@example.invalid', '', '{}', '{}', now(), now()
);

insert into public.financial_accounts (
  id, user_id, account_type_code, name, currency_code, opening_balance,
  is_active, closed_reason, bank_subtype, credit_card_limit
)
values
  ('2c000000-0000-4000-8000-000000000001', '1c000000-0000-4000-8000-000000000001', 'bank', 'Misr', 'USD', 0, true, null, 'debit', null),
  ('2c000000-0000-4000-8000-000000000002', '1c000000-0000-4000-8000-000000000001', 'bank', 'Closed Reusable', 'USD', 0, false, null, 'debit', null),
  ('2c000000-0000-4000-8000-000000000004', '1c000000-0000-4000-8000-000000000001', 'bank', 'Reopen Different', 'USD', 0, false, null, 'debit', null),
  ('2c000000-0000-4000-8000-000000000005', '1c000000-0000-4000-8000-000000000001', 'bank', 'Reopen Different', 'USD', 500, true, null, 'credit', 1000),
  ('2c000000-0000-4000-8000-000000000006', '1c000000-0000-4000-8000-000000000001', 'bank', 'Reopen Conflict', 'USD', 0, false, null, 'debit', null),
  ('2c000000-0000-4000-8000-000000000007', '1c000000-0000-4000-8000-000000000001', 'bank', 'Reopen Conflict', 'USD', 0, true, null, 'debit', null),
  ('2c000000-0000-4000-8000-000000000008', '1c000000-0000-4000-8000-000000000001', 'bank', 'Rename Source', 'USD', 0, true, null, 'debit', null);

insert into public.financial_accounts (
  id, user_id, account_type_code, name, currency_code, opening_balance,
  is_active, closed_reason, property_type, ownership_percentage,
  initial_ownership_percentage
)
values (
  '2c000000-0000-4000-8000-000000000003',
  '1c000000-0000-4000-8000-000000000001',
  'real_estate', 'Sold Reusable', 'USD', 0, false, 'sold', 'other', 0, 100
);

insert into public.financial_accounts
  (user_id, account_type_code, name, currency_code, opening_balance,
   bank_subtype, credit_card_limit)
values
  ('1c000000-0000-4000-8000-000000000001', 'bank', 'Misr', 'USD', 500,
   'credit', 1000);
\echo ok 1 - same active name is allowed for Bank Debit and Bank Credit

select pg_temp.expect_name_conflict($sql$
  insert into public.financial_accounts
    (user_id, account_type_code, name, currency_code, opening_balance, bank_subtype)
  values
    ('1c000000-0000-4000-8000-000000000001', 'bank', 'Misr', 'USD', 0, 'debit')
$sql$);
\echo ok 2 - same active normalized name and same account type is rejected

select pg_temp.expect_name_conflict($sql$
  insert into public.financial_accounts
    (user_id, account_type_code, name, currency_code, opening_balance, bank_subtype)
  values
    ('1c000000-0000-4000-8000-000000000001', 'bank', '  mIsR  ', 'USD', 0, 'debit')
$sql$);
\echo ok 3 - same-type case and whitespace variants are rejected

insert into public.financial_accounts
  (user_id, account_type_code, name, currency_code, opening_balance)
values
  ('1c000000-0000-4000-8000-000000000001', 'cash', 'Closed Reusable', 'USD', 0),
  ('1c000000-0000-4000-8000-000000000001', 'bank', 'Sold Reusable', 'USD', 0);
do $test$ begin
  if not exists (
    select 1 from public.financial_accounts
    where id = '2c000000-0000-4000-8000-000000000002'
      and name = 'Closed Reusable' and not is_active
  ) or not exists (
    select 1 from public.financial_accounts
    where id = '2c000000-0000-4000-8000-000000000003'
      and name = 'Sold Reusable' and not is_active and closed_reason = 'sold'
  ) then raise exception 'historical names or lifecycle state changed'; end if;
end; $test$;
\echo ok 4 - Closed and Sold names can be reused

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '1c000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

select public.reopen_financial_account('2c000000-0000-4000-8000-000000000004');
do $test$ begin
  if not exists (
    select 1 from public.financial_accounts
    where id = '2c000000-0000-4000-8000-000000000004' and is_active
  ) then raise exception 'non-conflicting account was not reopened'; end if;
end; $test$;
\echo ok 5 - reopen succeeds when only a different account type has the name

select pg_temp.expect_name_conflict($sql$
  select public.reopen_financial_account('2c000000-0000-4000-8000-000000000006')
$sql$);
\echo ok 6 - reopen rejects same normalized name and same account type

update public.financial_accounts
set name = ' reopen different '
where id = '2c000000-0000-4000-8000-000000000008';
do $test$ begin
  if not exists (
    select 1 from public.financial_accounts
    where id = '2c000000-0000-4000-8000-000000000008'
      and name = ' reopen different '
  ) then raise exception 'cross-subtype rename did not persist'; end if;
end; $test$;
\echo ok 7 - rename to a name used by the other Bank subtype is allowed

select pg_temp.expect_name_conflict($sql$
  update public.financial_accounts
  set name = ' misr '
  where id = '2c000000-0000-4000-8000-000000000008'
$sql$);
\echo ok 8 - rename to same normalized name and type is rejected

rollback;
