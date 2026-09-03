begin;

\echo 1..4

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '1a000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'account-lifecycle@example.invalid', '',
  '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.financial_accounts (
  id, user_id, account_type_code, name, currency_code, opening_balance
)
values (
  '2a000000-0000-4000-8000-000000000001',
  '1a000000-0000-4000-8000-000000000001',
  'cash', 'Lifecycle Cash', 'USD', 0
);

insert into public.financial_accounts (
  id, user_id, account_type_code, name, currency_code, opening_balance,
  property_type, ownership_percentage, initial_ownership_percentage
)
values (
  '2a000000-0000-4000-8000-000000000002',
  '1a000000-0000-4000-8000-000000000001',
  'real_estate', 'Lifecycle Property', 'USD', 0,
  'apartment', 100, 100
);

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '1a000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

do $test$
begin
  begin
    update public.financial_accounts
    set closed_reason = 'sold'
    where id = '2a000000-0000-4000-8000-000000000001';
    raise exception 'direct closed_reason update unexpectedly succeeded';
  exception
    when insufficient_privilege then
      if sqlerrm <> 'account sale status is derived from disposal history' then
        raise;
      end if;
  end;
end;
$test$;

\echo ok 1 - authenticated direct closed_reason update fails

do $test$
begin
  begin
    update public.financial_accounts
    set closed_on = current_date
    where id = '2a000000-0000-4000-8000-000000000001';
    raise exception 'direct closed_on update unexpectedly succeeded';
  exception
    when insufficient_privilege then
      if sqlerrm <> 'account sale status is derived from disposal history' then
        raise;
      end if;
  end;
end;
$test$;

\echo ok 2 - authenticated direct closed_on update fails

select public.close_financial_account('2a000000-0000-4000-8000-000000000001');

do $test$
begin
  if (select is_active from public.financial_accounts
      where id = '2a000000-0000-4000-8000-000000000001') then
    raise exception 'close RPC did not deactivate account';
  end if;
end;
$test$;

select public.reopen_financial_account('2a000000-0000-4000-8000-000000000001');

do $test$
begin
  if not (select is_active from public.financial_accounts
          where id = '2a000000-0000-4000-8000-000000000001') then
    raise exception 'reopen RPC did not activate account';
  end if;
end;
$test$;

\echo ok 3 - authenticated close and reopen RPCs work

select public.add_account_disposal(
  p_account_id => '2a000000-0000-4000-8000-000000000002',
  p_disposed_on => current_date,
  p_sale_amount => 100000,
  p_sale_currency_code => 'USD',
  p_ownership_percentage_sold => 100,
  p_idempotency_key => '3a000000-0000-4000-8000-000000000001',
  p_notes => 'Lifecycle projection test',
  p_destination_account_id => '2a000000-0000-4000-8000-000000000001'
);

do $test$
begin
  if not exists (
    select 1 from public.financial_accounts
    where id = '2a000000-0000-4000-8000-000000000002'
      and not is_active
      and ownership_percentage = 0
      and closed_reason = 'sold'
      and closed_on = current_date
  ) then
    raise exception 'disposal did not project Sold lifecycle state';
  end if;
end;
$test$;

\echo ok 4 - authenticated disposal projects Sold state

rollback;
