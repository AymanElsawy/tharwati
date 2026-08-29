alter table public.goals
  add constraint goals_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

create or replace function public.prevent_goal_progress_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and (
    not exists (
      select 1
      from public.goals
      where id = old.goal_id and user_id = old.user_id
    )
    or not exists (
      select 1
      from auth.users
      where id = old.user_id
    )
  ) then
    return old;
  end if;

  raise exception 'Goal progress history is immutable';
end;
$$;

revoke all on function public.prevent_goal_progress_mutation()
  from public, anon, authenticated;
