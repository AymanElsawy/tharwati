create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null check (btrim(name) <> ''),
  goal_type text not null check (goal_type in ('buy_home','buy_car','travel','education','other')),
  custom_type_name text,
  target_amount numeric(20,2) not null check (target_amount > 0),
  currency_code text not null check (currency_code in ('USD','SAR','EGP','EUR','GBP')),
  target_date date,
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goals_id_user_key unique (id, user_id),
  constraint goals_custom_type_check check (
    (goal_type = 'other' and custom_type_name is not null and btrim(custom_type_name) <> '')
    or (goal_type <> 'other' and custom_type_name is null)
  )
);

create table public.goal_progress_entries (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_type text not null check (entry_type in ('progress','withdrawal','reversal')),
  amount numeric(20,2) not null check (amount > 0),
  effective_on date not null check (effective_on <= current_date),
  note text,
  reverses_entry_id uuid,
  replacement_for_entry_id uuid,
  created_at timestamptz not null default now(),
  constraint goal_progress_entries_goal_owner_fkey foreign key (goal_id, user_id)
    references public.goals(id, user_id) on delete cascade,
  constraint goal_progress_entries_id_goal_user_key unique (id, goal_id, user_id),
  constraint goal_progress_entries_reversal_owner_fkey
    foreign key (reverses_entry_id, goal_id, user_id)
    references public.goal_progress_entries(id, goal_id, user_id) on delete cascade,
  constraint goal_progress_entries_replacement_owner_fkey
    foreign key (replacement_for_entry_id, goal_id, user_id)
    references public.goal_progress_entries(id, goal_id, user_id) on delete cascade,
  constraint goal_progress_reversal_shape_check check (
    (entry_type = 'reversal' and reverses_entry_id is not null and replacement_for_entry_id is null)
    or (entry_type <> 'reversal' and reverses_entry_id is null)
  )
);

create unique index goal_progress_entries_one_reversal_idx
  on public.goal_progress_entries(reverses_entry_id) where reverses_entry_id is not null;
create unique index goal_progress_entries_one_replacement_idx
  on public.goal_progress_entries(replacement_for_entry_id) where replacement_for_entry_id is not null;
create index goals_user_status_idx on public.goals(user_id,status,archived_at);
create index goal_progress_entries_goal_date_idx on public.goal_progress_entries(goal_id,effective_on,created_at);

alter table public.goals enable row level security;
alter table public.goal_progress_entries enable row level security;
create policy goals_select_own on public.goals for select to authenticated using ((select auth.uid()) = user_id);
create policy goal_progress_entries_select_own on public.goal_progress_entries for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.goals, public.goal_progress_entries to authenticated;

create function public.goal_funded_amount(p_goal_id uuid)
returns numeric
language sql stable security definer set search_path = ''
as $$
  select coalesce(sum(case
    when e.entry_type = 'progress' then e.amount
    when e.entry_type = 'withdrawal' then -e.amount
    when original.entry_type = 'progress' then -e.amount
    when original.entry_type = 'withdrawal' then e.amount
    else 0 end), 0)::numeric
  from public.goal_progress_entries e
  left join public.goal_progress_entries original on original.id = e.reverses_entry_id
  where e.goal_id = p_goal_id;
$$;

create function public.create_goal(
  p_name text, p_goal_type text, p_custom_type_name text,
  p_target_amount numeric, p_currency_code text, p_target_date date,
  p_saved_so_far numeric default null, p_saved_on date default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_goal_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_saved_so_far is not null and p_saved_so_far <= 0 then raise exception 'Saved so far must be positive'; end if;
  if p_saved_so_far is not null and coalesce(p_saved_on, current_date) > current_date then raise exception 'Progress date cannot be in the future'; end if;
  insert into public.goals(user_id,name,goal_type,custom_type_name,target_amount,currency_code,target_date)
  values(v_user_id,btrim(p_name),p_goal_type,case when p_goal_type='other' then nullif(btrim(p_custom_type_name),'') else null end,p_target_amount,p_currency_code,p_target_date)
  returning id into v_goal_id;
  if p_saved_so_far is not null then
    insert into public.goal_progress_entries(goal_id,user_id,entry_type,amount,effective_on)
    values(v_goal_id,v_user_id,'progress',p_saved_so_far,coalesce(p_saved_on,current_date));
  end if;
  return v_goal_id;
end; $$;

create function public.update_goal(
  p_goal_id uuid, p_name text, p_goal_type text, p_custom_type_name text,
  p_target_amount numeric, p_currency_code text, p_target_date date
) returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_current_currency text;
begin
  select currency_code into v_current_currency from public.goals where id=p_goal_id and user_id=v_user_id for update;
  if not found then raise exception 'Goal not found'; end if;
  if p_currency_code <> v_current_currency and exists(select 1 from public.goal_progress_entries where goal_id=p_goal_id) then
    raise exception 'Goal currency is locked after progress history exists';
  end if;
  update public.goals set name=btrim(p_name), goal_type=p_goal_type,
    custom_type_name=case when p_goal_type='other' then nullif(btrim(p_custom_type_name),'') else null end,
    target_amount=p_target_amount, currency_code=p_currency_code, target_date=p_target_date, updated_at=now()
  where id=p_goal_id and user_id=v_user_id;
end; $$;

create function public.add_goal_progress_entry(
  p_goal_id uuid, p_entry_type text, p_amount numeric, p_effective_on date, p_note text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_entry_id uuid; v_goal public.goals%rowtype;
begin
  if p_entry_type not in ('progress','withdrawal') then raise exception 'Invalid goal entry type'; end if;
  if p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  if p_effective_on > current_date then raise exception 'Progress date cannot be in the future'; end if;
  select * into v_goal from public.goals where id=p_goal_id and user_id=v_user_id for update;
  if not found then raise exception 'Goal not found'; end if;
  if v_goal.status <> 'active' or v_goal.archived_at is not null then raise exception 'Goal must be active and unarchived'; end if;
  if p_entry_type='withdrawal' and public.goal_funded_amount(p_goal_id) < p_amount then raise exception 'Withdrawal exceeds funded amount'; end if;
  insert into public.goal_progress_entries(goal_id,user_id,entry_type,amount,effective_on,note)
  values(p_goal_id,v_user_id,p_entry_type,p_amount,p_effective_on,nullif(btrim(p_note),'')) returning id into v_entry_id;
  return v_entry_id;
end; $$;

create function public.correct_goal_progress_entry(
  p_entry_id uuid, p_replacement_amount numeric default null,
  p_replacement_effective_on date default null, p_note text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_original public.goal_progress_entries%rowtype; v_goal public.goals%rowtype; v_replacement_id uuid;
begin
  select * into v_original from public.goal_progress_entries where id=p_entry_id and user_id=v_user_id and entry_type in ('progress','withdrawal') for update;
  if not found then raise exception 'Correctable entry not found'; end if;
  select * into v_goal from public.goals where id=v_original.goal_id and user_id=v_user_id for update;
  if v_goal.status <> 'active' or v_goal.archived_at is not null then raise exception 'Goal must be active and unarchived'; end if;
  if exists(select 1 from public.goal_progress_entries where reverses_entry_id=p_entry_id) then raise exception 'Entry already reversed'; end if;
  if p_replacement_amount is not null and p_replacement_amount <= 0 then raise exception 'Replacement amount must be positive'; end if;
  if p_replacement_amount is not null and p_replacement_effective_on is null then raise exception 'Replacement date is required'; end if;
  if p_replacement_effective_on > current_date then raise exception 'Progress date cannot be in the future'; end if;
  insert into public.goal_progress_entries(goal_id,user_id,entry_type,amount,effective_on,note,reverses_entry_id)
  values(v_original.goal_id,v_user_id,'reversal',v_original.amount,v_original.effective_on,nullif(btrim(p_note),''),v_original.id);
  if p_replacement_amount is not null then
    insert into public.goal_progress_entries(goal_id,user_id,entry_type,amount,effective_on,note,replacement_for_entry_id)
    values(v_original.goal_id,v_user_id,v_original.entry_type,p_replacement_amount,p_replacement_effective_on,nullif(btrim(p_note),''),v_original.id) returning id into v_replacement_id;
  end if;
  if public.goal_funded_amount(v_original.goal_id) < 0 then raise exception 'Correction would make funded amount negative'; end if;
  return v_replacement_id;
end; $$;

create function public.set_goal_status(p_goal_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('active','completed','cancelled') then raise exception 'Invalid goal status'; end if;
  update public.goals set status=p_status, updated_at=now() where id=p_goal_id and user_id=auth.uid();
  if not found then raise exception 'Goal not found'; end if;
end; $$;

create function public.set_goal_archived(p_goal_id uuid, p_archived boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.goals set archived_at=case when p_archived then coalesce(archived_at,now()) else null end, updated_at=now()
  where id=p_goal_id and user_id=auth.uid();
  if not found then raise exception 'Goal not found'; end if;
end; $$;

create function public.prevent_goal_progress_mutation() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op = 'DELETE' and not exists (
    select 1 from public.goals where id = old.goal_id and user_id = old.user_id
  ) then
    return old;
  end if;
  raise exception 'Goal progress history is immutable';
end; $$;
create trigger goal_progress_entries_immutable before update or delete on public.goal_progress_entries
for each row execute function public.prevent_goal_progress_mutation();

revoke all on function public.goal_funded_amount(uuid), public.create_goal(text,text,text,numeric,text,date,numeric,date), public.update_goal(uuid,text,text,text,numeric,text,date), public.add_goal_progress_entry(uuid,text,numeric,date,text), public.correct_goal_progress_entry(uuid,numeric,date,text), public.set_goal_status(uuid,text), public.set_goal_archived(uuid,boolean) from public, anon;
revoke all on function public.goal_funded_amount(uuid), public.prevent_goal_progress_mutation() from authenticated;
revoke all on function public.prevent_goal_progress_mutation() from public, anon;
grant execute on function public.create_goal(text,text,text,numeric,text,date,numeric,date), public.update_goal(uuid,text,text,text,numeric,text,date), public.add_goal_progress_entry(uuid,text,numeric,date,text), public.correct_goal_progress_entry(uuid,numeric,date,text), public.set_goal_status(uuid,text), public.set_goal_archived(uuid,boolean) to authenticated;
