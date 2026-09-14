create table public.wealth_allocation_target_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tolerance_percentage numeric(9, 6) not null check (
    tolerance_percentage >= 0 and tolerance_percentage <= 100
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.wealth_allocation_target_preferences is
  'Per-user settings for Wealth Target Allocation; one tolerance applies to the complete plan.';

alter table public.wealth_allocation_target_preferences enable row level security;

create policy wealth_allocation_target_preferences_select_own
  on public.wealth_allocation_target_preferences
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.wealth_allocation_target_preferences
  from public, anon, authenticated;
grant select on table public.wealth_allocation_target_preferences
  to authenticated;

create trigger wealth_allocation_target_preferences_set_updated_at
  before update on public.wealth_allocation_target_preferences
  for each row execute function public.set_updated_at();

create function public.replace_wealth_allocation_plan(
  p_targets jsonb,
  p_tolerance_percentage numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;

  if p_tolerance_percentage is null
    or p_tolerance_percentage::text !~ '^[0-9]+([.][0-9]{1,6})?$'
    or p_tolerance_percentage < 0
    or p_tolerance_percentage > 100 then
    raise exception using errcode = '22023', message = 'Tolerance must be a decimal from 0 to 100';
  end if;

  perform public.replace_wealth_allocation_targets(p_targets);

  insert into public.wealth_allocation_target_preferences (
    user_id,
    tolerance_percentage
  )
  values (
    v_user_id,
    p_tolerance_percentage
  )
  on conflict (user_id) do update
  set tolerance_percentage = excluded.tolerance_percentage;
end;
$$;

-- Transitional compatibility: preserve the existing authenticated EXECUTE grant
-- for deployed clients that still save targets without tolerance. Revoke that
-- legacy write path in a later forward migration after updated clients ship.
revoke all on function public.replace_wealth_allocation_plan(jsonb, numeric)
  from public, anon, authenticated;
grant execute on function public.replace_wealth_allocation_plan(jsonb, numeric)
  to authenticated;
