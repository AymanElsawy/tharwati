begin;

\echo 1..5

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('71000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','goal-delete-1@example.invalid','','{}','{}',now(),now()),
  ('71000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','goal-delete-2@example.invalid','','{}','{}',now(),now());

insert into public.goals (id,user_id,name,goal_type,target_amount,currency_code,status,archived_at)
values
  ('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','Active','buy_car',100,'USD','active',null),
  ('72000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000001','Archived','buy_car',100,'USD','active',now()),
  ('72000000-0000-4000-8000-000000000003','71000000-0000-4000-8000-000000000001','Completed','buy_car',100,'USD','completed',null),
  ('72000000-0000-4000-8000-000000000004','71000000-0000-4000-8000-000000000001','Cancelled','buy_car',100,'USD','cancelled',null),
  ('72000000-0000-4000-8000-000000000010','71000000-0000-4000-8000-000000000001','Unrelated','buy_car',100,'USD','active',null),
  ('72000000-0000-4000-8000-000000000020','71000000-0000-4000-8000-000000000002','Other user','buy_car',100,'USD','active',null);

select pg_catalog.set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.delete_goal('72000000-0000-4000-8000-000000000001');
select public.delete_goal('72000000-0000-4000-8000-000000000002');
select public.delete_goal('72000000-0000-4000-8000-000000000003');
select public.delete_goal('72000000-0000-4000-8000-000000000004');
reset role;
do $$ begin if exists (select 1 from public.goals where id in ('72000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000002','72000000-0000-4000-8000-000000000003','72000000-0000-4000-8000-000000000004')) then raise exception 'lifecycle delete failed'; end if; end $$;
\echo ok 1 - zero-history goals in every lifecycle state are deleted

set local role authenticated;
do $$ begin perform public.delete_goal('72000000-0000-4000-8000-000000000020'); raise exception 'wrong-user delete succeeded'; exception when no_data_found then null; end $$;
do $$ begin perform public.delete_goal('72000000-0000-4000-8000-000000000099'); raise exception 'missing delete succeeded'; exception when no_data_found then null; end $$;
reset role;
\echo ok 2 - missing and wrong-user goals are rejected

insert into public.goals (id,user_id,name,goal_type,target_amount,currency_code) values
 ('72000000-0000-4000-8000-000000000031','71000000-0000-4000-8000-000000000001','Progress','buy_car',100,'USD'),
 ('72000000-0000-4000-8000-000000000032','71000000-0000-4000-8000-000000000001','Withdrawal','buy_car',100,'USD'),
 ('72000000-0000-4000-8000-000000000033','71000000-0000-4000-8000-000000000001','Correction','buy_car',100,'USD'),
 ('72000000-0000-4000-8000-000000000034','71000000-0000-4000-8000-000000000001','Initial saved','buy_car',100,'USD');
insert into public.goal_progress_entries (id,goal_id,user_id,entry_type,amount,effective_on) values
 ('73000000-0000-4000-8000-000000000031','72000000-0000-4000-8000-000000000031','71000000-0000-4000-8000-000000000001','progress',10,current_date),
 ('73000000-0000-4000-8000-000000000032','72000000-0000-4000-8000-000000000032','71000000-0000-4000-8000-000000000001','withdrawal',10,current_date),
 ('73000000-0000-4000-8000-000000000033','72000000-0000-4000-8000-000000000033','71000000-0000-4000-8000-000000000001','progress',10,current_date),
 ('73000000-0000-4000-8000-000000000034','72000000-0000-4000-8000-000000000034','71000000-0000-4000-8000-000000000001','progress',10,current_date);
insert into public.goal_progress_entries (id,goal_id,user_id,entry_type,amount,effective_on,reverses_entry_id) values
 ('73000000-0000-4000-8000-000000000035','72000000-0000-4000-8000-000000000033','71000000-0000-4000-8000-000000000001','reversal',10,current_date,'73000000-0000-4000-8000-000000000033');
insert into public.goal_progress_entries (id,goal_id,user_id,entry_type,amount,effective_on,replacement_for_entry_id) values
 ('73000000-0000-4000-8000-000000000036','72000000-0000-4000-8000-000000000033','71000000-0000-4000-8000-000000000001','progress',12,current_date,'73000000-0000-4000-8000-000000000033');
set local role authenticated;
do $$ declare g uuid; begin foreach g in array array['72000000-0000-4000-8000-000000000031'::uuid,'72000000-0000-4000-8000-000000000032'::uuid,'72000000-0000-4000-8000-000000000033'::uuid,'72000000-0000-4000-8000-000000000034'::uuid] loop begin perform public.delete_goal(g); raise exception 'history delete succeeded'; exception when check_violation then null; end; end loop; end $$;
reset role;
\echo ok 3 - all raw history shapes permanently block deletion

insert into public.goal_progress_entries (id,goal_id,user_id,entry_type,amount,effective_on) values
 ('73000000-0000-4000-8000-000000000037','72000000-0000-4000-8000-000000000031','71000000-0000-4000-8000-000000000001','withdrawal',10,current_date);
set local role authenticated;
do $$ begin perform public.delete_goal('72000000-0000-4000-8000-000000000031'); raise exception 'net-zero delete succeeded'; exception when check_violation then null; end $$;
reset role;
\echo ok 4 - net-zero history still blocks deletion

do $$ begin if not exists (select 1 from public.goals where id='72000000-0000-4000-8000-000000000010') or not exists (select 1 from public.goals where id='72000000-0000-4000-8000-000000000020') then raise exception 'unrelated goal changed'; end if; end $$;
\echo ok 5 - unrelated goals remain untouched

rollback;
