begin;

\echo 1..5

create or replace function pg_temp.expect_bank_subtype_violation(p_statement text)
returns void
language plpgsql
as $$
begin
  execute p_statement;
  raise exception 'statement unexpectedly succeeded';
exception
  when check_violation then
    if position('financial_accounts_bank_subtype_check' in sqlerrm) = 0 then
      raise;
    end if;
end;
$$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '1d000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'bank-shape@example.invalid', '', '{}', '{}', now(), now()
);

insert into public.financial_accounts (
  id, user_id, account_type_code, name, currency_code, opening_balance,
  bank_subtype, credit_card_limit
)
values
  ('2d000000-0000-4000-8000-000000000001', '1d000000-0000-4000-8000-000000000001', 'bank', 'Debit', 'USD', 0, 'debit', null),
  ('2d000000-0000-4000-8000-000000000002', '1d000000-0000-4000-8000-000000000001', 'bank', 'Credit', 'USD', 500, 'credit', 1000),
  ('2d000000-0000-4000-8000-000000000003', '1d000000-0000-4000-8000-000000000001', 'cash', 'Cash', 'USD', 0, null, null);
\echo ok 1 - Bank Debit and Bank Credit are accepted and non-bank null is accepted

select pg_temp.expect_bank_subtype_violation($sql$
  insert into public.financial_accounts
    (user_id, account_type_code, name, currency_code, opening_balance, bank_subtype)
  values
    ('1d000000-0000-4000-8000-000000000001', 'bank', 'Missing subtype', 'USD', 0, null)
$sql$);
\echo ok 2 - Bank with a null subtype is rejected

select pg_temp.expect_bank_subtype_violation($sql$
  insert into public.financial_accounts
    (user_id, account_type_code, name, currency_code, opening_balance, bank_subtype)
  values
    ('1d000000-0000-4000-8000-000000000001', 'cash', 'Invalid Cash', 'USD', 0, 'debit')
$sql$);
\echo ok 3 - non-bank with a subtype is rejected

select pg_temp.expect_bank_subtype_violation($sql$
  update public.financial_accounts
  set bank_subtype = null
  where id = '2d000000-0000-4000-8000-000000000001'
$sql$);
\echo ok 4 - invalid subtype updates are rejected for Bank

select pg_temp.expect_bank_subtype_violation($sql$
  update public.financial_accounts
  set bank_subtype = 'credit'
  where id = '2d000000-0000-4000-8000-000000000003'
$sql$);
\echo ok 5 - invalid subtype updates are rejected for non-bank

rollback;
