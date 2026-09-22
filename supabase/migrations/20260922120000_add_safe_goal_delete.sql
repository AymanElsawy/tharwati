create function public.delete_goal(p_goal_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_goal public.goals%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_goal
  from public.goals
  where id = p_goal_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Goal not found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.goal_progress_entries
    where goal_id = v_goal.id
  ) then
    raise exception 'Goal with progress history cannot be deleted' using errcode = '23514';
  end if;

  delete from public.goals
  where id = v_goal.id and user_id = v_user_id;
end;
$$;

revoke all on function public.delete_goal(uuid) from public, anon;
grant execute on function public.delete_goal(uuid) to authenticated;

revoke delete on public.goals, public.goal_progress_entries
  from public, anon, authenticated;

comment on function public.delete_goal(uuid) is
  'Permanently deletes one owned Goal only when it has no raw progress history rows.';
