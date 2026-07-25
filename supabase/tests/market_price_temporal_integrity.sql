begin;

\echo 1..7

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '14000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'market-price-a@example.invalid',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '14000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'market-price-b@example.invalid',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.assets (
  id,
  user_id,
  asset_type_code,
  name,
  symbol,
  currency_code,
  exchange,
  is_custom
)
values
  (
    '24000000-0000-4000-8000-000000000001',
    '14000000-0000-4000-8000-000000000001',
    'stock',
    'Temporal Price Asset',
    'TPA',
    'USD',
    'XTEST',
    true
  ),
  (
    '24000000-0000-4000-8000-000000000002',
    '14000000-0000-4000-8000-000000000001',
    'stock',
    'Future Only Asset',
    'FOA',
    'USD',
    'XTEST',
    true
  );

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '14000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

insert into public.market_prices (
  id,
  user_id,
  asset_id,
  provider,
  price,
  currency_code,
  as_of
)
values
  (
    '34000000-0000-4000-8000-000000000001',
    '14000000-0000-4000-8000-000000000001',
    '24000000-0000-4000-8000-000000000001',
    'manual',
    90,
    'USD',
    now() - interval '1 day'
  ),
  (
    '34000000-0000-4000-8000-000000000002',
    '14000000-0000-4000-8000-000000000001',
    '24000000-0000-4000-8000-000000000001',
    'manual',
    100,
    'USD',
    now()
  );

\echo ok 1 - current and past market prices can be inserted

do $test$
begin
  begin
    insert into public.market_prices (
      user_id,
      asset_id,
      provider,
      price,
      currency_code,
      as_of
    )
    values (
      '14000000-0000-4000-8000-000000000001',
      '24000000-0000-4000-8000-000000000001',
      'manual',
      999,
      'USD',
      now() + interval '1 day'
    );
    raise exception 'future market-price insert unexpectedly succeeded';
  exception
    when check_violation then
      if sqlerrm <> 'Market price date cannot be in the future.' then
        raise;
      end if;
  end;
end;
$test$;

\echo ok 2 - future market-price inserts are rejected

do $test$
begin
  begin
    update public.market_prices
    set as_of = now() + interval '1 hour'
    where id = '34000000-0000-4000-8000-000000000001';
    raise exception 'future market-price update unexpectedly succeeded';
  exception
    when check_violation then
      if sqlerrm <> 'Market price date cannot be in the future.' then
        raise;
      end if;
  end;
end;
$test$;

\echo ok 3 - existing prices cannot be updated into the future

reset role;

-- Simulate legacy future rows that predate the enforcement migration. This is
-- the only administrative bypass used by the test and is rolled back.
alter table public.market_prices
  disable trigger market_prices_10_prevent_future_as_of;

insert into public.market_prices (
  id,
  user_id,
  asset_id,
  provider,
  price,
  currency_code,
  as_of
)
values
  (
    '34000000-0000-4000-8000-000000000003',
    '14000000-0000-4000-8000-000000000001',
    '24000000-0000-4000-8000-000000000001',
    'manual',
    1000,
    'USD',
    now() + interval '1 day'
  ),
  (
    '34000000-0000-4000-8000-000000000004',
    '14000000-0000-4000-8000-000000000001',
    '24000000-0000-4000-8000-000000000002',
    'manual',
    500,
    'USD',
    now() + interval '1 day'
  );

alter table public.market_prices
  enable trigger market_prices_10_prevent_future_as_of;

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '14000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

do $test$
declare
  v_price numeric;
begin
  select price into strict v_price
  from public.get_current_market_price(
    '24000000-0000-4000-8000-000000000001'
  );

  if v_price <> 100 then
    raise exception 'future row was selected as current: %', v_price;
  end if;
end;
$test$;

\echo ok 4 - current-price resolution ignores future rows

do $test$
begin
  if exists (
    select 1
    from public.get_current_market_price(
      '24000000-0000-4000-8000-000000000002'
    )
  ) then
    raise exception 'future-only asset returned a current price';
  end if;
end;
$test$;

\echo ok 5 - a future-only asset has no current price

do $test$
declare
  v_price_id uuid;
begin
  select id into strict v_price_id
  from public.get_current_market_price(
    '24000000-0000-4000-8000-000000000001'
  );

  if v_price_id <> '34000000-0000-4000-8000-000000000002' then
    raise exception 'latest eligible price was not selected: %', v_price_id;
  end if;
end;
$test$;

\echo ok 6 - latest eligible price is selected deterministically

reset role;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '14000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;

do $test$
declare
  v_count bigint;
begin
  select count(*) into v_count
  from public.market_prices
  where user_id = '14000000-0000-4000-8000-000000000001';

  if v_count <> 0 then
    raise exception 'user B can read user A manual prices';
  end if;

  update public.market_prices
  set price = 1
  where user_id = '14000000-0000-4000-8000-000000000001';

  if found then
    raise exception 'user B modified user A manual prices';
  end if;
end;
$test$;

\echo ok 7 - user-owned manual prices remain isolated

rollback;
