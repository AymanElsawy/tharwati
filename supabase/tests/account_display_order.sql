begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('9a000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'order-a@example.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('9a000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'order-b@example.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.financial_accounts
  (id, user_id, account_type_code, name, currency_code, opening_balance)
values
  ('9b000000-0000-4000-8000-000000000001', '9a000000-0000-4000-8000-000000000001', 'cash', 'Zulu', 'USD', 0),
  ('9b000000-0000-4000-8000-000000000002', '9a000000-0000-4000-8000-000000000001', 'cash', 'Alpha', 'USD', 0),
  ('9b000000-0000-4000-8000-000000000003', '9a000000-0000-4000-8000-000000000001', 'other', 'Beta', 'USD', 0),
  ('9b000000-0000-4000-8000-000000000004', '9a000000-0000-4000-8000-000000000002', 'cash', 'Other user', 'USD', 0);

-- Simulate existing saved order and a newly created account with no row.
insert into public.account_display_order (account_id, user_id, position) values
  ('9b000000-0000-4000-8000-000000000001', '9a000000-0000-4000-8000-000000000001', 1),
  ('9b000000-0000-4000-8000-000000000002', '9a000000-0000-4000-8000-000000000001', 2),
  ('9b000000-0000-4000-8000-000000000004', '9a000000-0000-4000-8000-000000000002', 1);

do $test$
begin
  begin
    insert into public.account_display_order (account_id, user_id, position)
    values ('9b000000-0000-4000-8000-000000000003',
            '9a000000-0000-4000-8000-000000000002', 42);
    raise exception 'cross-owner FK accepted';
  exception when foreign_key_violation then null;
  end;
end;
$test$;

select pg_catalog.set_config('request.jwt.claim.sub', '9a000000-0000-4000-8000-000000000001', true);
set local role authenticated;

do $test$
declare
  a constant uuid := '9b000000-0000-4000-8000-000000000001';
  b constant uuid := '9b000000-0000-4000-8000-000000000002';
  c constant uuid := '9b000000-0000-4000-8000-000000000003';
  foreign_id constant uuid := '9b000000-0000-4000-8000-000000000004';
  original constant uuid[] := array[a,b,c];
  desired constant uuid[] := array[b,a,c];
  candidate uuid[];
  attempt integer;
  previous_update timestamptz;
begin
  if (select count(*) from public.account_display_order) <> 2 then
    raise exception 'RLS exposed another user order row';
  end if;
  if (select count(*) from public.account_display_order where account_id = foreign_id) <> 0 then
    raise exception 'RLS exposed foreign row';
  end if;
  if public.get_account_custom_order() is distinct from original then
    raise exception 'unranked account was not appended';
  end if;
  if exists (select 1 from public.account_display_order where account_id = c) then
    raise exception 'new account received order row without reorder';
  end if;

  begin
    insert into public.account_display_order(account_id,user_id,position)
    values (c, auth.uid(), 3);
    raise exception 'direct insert accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.account_display_order set position = 3 where account_id = a;
    raise exception 'direct update accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.account_display_order where account_id = a;
    raise exception 'direct delete accepted';
  exception when insufficient_privilege then null;
  end;

  for attempt in 1..4 loop
    candidate := case attempt
      when 1 then array[a,a,c]
      when 2 then array[a,c]
      when 3 then array[a,b,foreign_id]
      else array[a,b,null::uuid]
    end;
    begin
      perform public.reorder_accounts(original, candidate);
      raise exception 'invalid order accepted';
    exception when invalid_parameter_value then null;
    end;
    if public.get_account_custom_order() is distinct from original then
      raise exception 'invalid reorder partially committed';
    end if;
  end loop;

  select updated_at into previous_update from public.financial_accounts where id = a;
  if public.reorder_accounts(original, desired) is distinct from desired then
    raise exception 'reorder returned wrong order';
  end if;
  if (select updated_at from public.financial_accounts where id = a) is distinct from previous_update then
    raise exception 'reorder touched financial_accounts.updated_at';
  end if;
  if not exists (select 1 from public.account_display_order where account_id = c and position = 3) then
    raise exception 'reorder did not save formerly unranked account';
  end if;
  if public.reorder_accounts(original, desired) is distinct from desired then
    raise exception 'identical replay did not succeed';
  end if;
  begin
    perform public.reorder_accounts(original, array[a,c,b]);
    raise exception 'stale expected order accepted';
  exception when sqlstate 'PT409' then null;
  end;
  if public.get_account_custom_order() is distinct from desired then
    raise exception 'competing reorder overwrote current order';
  end if;
end;
$test$;

select pg_catalog.set_config('request.jwt.claim.sub', '9a000000-0000-4000-8000-000000000002', true);
do $test$
begin
  if public.get_account_custom_order() is distinct from
    array['9b000000-0000-4000-8000-000000000004'::uuid] then
    raise exception 'second user saw another user account';
  end if;
  if (select count(*) from public.account_display_order) <> 1 then
    raise exception 'second user saw another user order row';
  end if;
end;
$test$;
select pg_catalog.set_config('request.jwt.claim.sub', '9a000000-0000-4000-8000-000000000001', true);

select public.close_financial_account('9b000000-0000-4000-8000-000000000001');
do $test$
begin
  if public.get_account_custom_order() is distinct from
    array['9b000000-0000-4000-8000-000000000002'::uuid,
          '9b000000-0000-4000-8000-000000000001'::uuid,
          '9b000000-0000-4000-8000-000000000003'::uuid] then
    raise exception 'close changed custom order';
  end if;
end;
$test$;
select public.reopen_financial_account('9b000000-0000-4000-8000-000000000001');
do $test$
begin
  if (select position from public.account_display_order
      where account_id = '9b000000-0000-4000-8000-000000000001') <> 2 then
    raise exception 'reopen lost prior position';
  end if;
end;
$test$;

insert into public.financial_accounts
  (id, user_id, account_type_code, name, currency_code, opening_balance)
values ('9b000000-0000-4000-8000-000000000005',
        '9a000000-0000-4000-8000-000000000001', 'cash', 'Aardvark', 'USD', 0);
do $test$
begin
  if (public.get_account_custom_order())[4] is distinct from
    '9b000000-0000-4000-8000-000000000005'::uuid then
    raise exception 'new name sorted before saved order';
  end if;
  if exists (select 1 from public.account_display_order
             where account_id = '9b000000-0000-4000-8000-000000000005') then
    raise exception 'create generated an order row';
  end if;
end;
$test$;

select public.reorder_accounts(
  public.get_account_custom_order(),
  public.get_account_custom_order()
);
select public.reorder_accounts(
  array['9b000000-0000-4000-8000-000000000002'::uuid,
        '9b000000-0000-4000-8000-000000000001'::uuid,
        '9b000000-0000-4000-8000-000000000003'::uuid,
        '9b000000-0000-4000-8000-000000000005'::uuid],
  array['9b000000-0000-4000-8000-000000000002'::uuid,
        '9b000000-0000-4000-8000-000000000001'::uuid,
        '9b000000-0000-4000-8000-000000000005'::uuid,
        '9b000000-0000-4000-8000-000000000003'::uuid]
);
select public.delete_pristine_financial_account('9b000000-0000-4000-8000-000000000005');
do $test$
begin
  if exists (select 1 from public.account_display_order
             where account_id = '9b000000-0000-4000-8000-000000000005') then
    raise exception 'delete did not cascade order row';
  end if;
end;
$test$;

insert into public.financial_accounts (
  id, user_id, account_type_code, name, currency_code, opening_balance,
  property_type, ownership_percentage, initial_ownership_percentage
) values (
  '9b000000-0000-4000-8000-000000000006',
  '9a000000-0000-4000-8000-000000000001',
  'real_estate', 'Property', 'USD', 0, 'apartment', 100, 100
);
select public.reorder_accounts(
  public.get_account_custom_order(),
  array['9b000000-0000-4000-8000-000000000006'::uuid,
        '9b000000-0000-4000-8000-000000000002'::uuid,
        '9b000000-0000-4000-8000-000000000001'::uuid,
        '9b000000-0000-4000-8000-000000000003'::uuid]
);
select public.add_account_disposal(
  p_account_id => '9b000000-0000-4000-8000-000000000006',
  p_disposed_on => current_date,
  p_sale_amount => 100000,
  p_sale_currency_code => 'USD',
  p_ownership_percentage_sold => 100,
  p_idempotency_key => '9c000000-0000-4000-8000-000000000001',
  p_notes => 'Order retention test',
  p_destination_account_id => '9b000000-0000-4000-8000-000000000002'
);
do $test$
begin
  if not exists (select 1 from public.financial_accounts
                 where id = '9b000000-0000-4000-8000-000000000006'
                   and closed_reason = 'sold') then
    raise exception 'test sale did not mark account Sold';
  end if;
  if (select position from public.account_display_order
      where account_id = '9b000000-0000-4000-8000-000000000006') <> 1 then
    raise exception 'Sold changed saved position';
  end if;
  if (public.get_account_custom_order())[1] is distinct from
     '9b000000-0000-4000-8000-000000000006'::uuid then
    raise exception 'Sold account missing from canonical order';
  end if;
end;
$test$;

set local role anon;
do $test$
begin
  begin
    perform 1 from public.account_display_order;
    raise exception 'anon read accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.get_account_custom_order();
    raise exception 'anon RPC accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.reorder_accounts('{}'::uuid[], '{}'::uuid[]);
    raise exception 'anon reorder accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.account_display_order (account_id, user_id, position)
    values ('9b000000-0000-4000-8000-000000000003',
            '9a000000-0000-4000-8000-000000000001', 99);
    raise exception 'anon insert accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.account_display_order set position = 99;
    raise exception 'anon update accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.account_display_order;
    raise exception 'anon delete accepted';
  exception when insufficient_privilege then null;
  end;
end;
$test$;

rollback;
