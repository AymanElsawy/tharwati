create table public.wealth_allocation_targets (
  user_id uuid not null references auth.users (id) on delete cascade,
  asset_class text not null check (
    asset_class in (
      'cash_and_bank',
      'brokerage',
      'gold_and_silver',
      'real_estate',
      'business',
      'other'
    )
  ),
  target_percentage numeric(9, 6) not null check (
    target_percentage >= 0 and target_percentage <= 100
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, asset_class)
);

comment on table public.wealth_allocation_targets is
  'User-selected Wealth Analysis asset-class targets; zero excludes a class from target comparison.';

alter table public.wealth_allocation_targets enable row level security;

create policy wealth_allocation_targets_select_own
  on public.wealth_allocation_targets
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.wealth_allocation_targets
  from public, anon, authenticated;
grant select on table public.wealth_allocation_targets to authenticated;

create trigger wealth_allocation_targets_set_updated_at
  before update on public.wealth_allocation_targets
  for each row execute function public.set_updated_at();

create function public.replace_wealth_allocation_targets(p_targets jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_total numeric;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;

  if p_targets is null or jsonb_typeof(p_targets) <> 'object' then
    raise exception using errcode = '22023', message = 'Targets must be a JSON object';
  end if;

  if (select count(*) from jsonb_object_keys(p_targets)) <> 6
    or exists (
      select 1
      from jsonb_object_keys(p_targets) as key
      where key not in (
        'cash_and_bank',
        'brokerage',
        'gold_and_silver',
        'real_estate',
        'business',
        'other'
      )
    )
    or exists (
      select 1
      from (values
        ('cash_and_bank'),
        ('brokerage'),
        ('gold_and_silver'),
        ('real_estate'),
        ('business'),
        ('other')
      ) as required(asset_class)
      where not (p_targets ? required.asset_class)
    ) then
    raise exception using errcode = '22023', message = 'Targets must contain every supported wealth asset class';
  end if;

  if exists (
    select 1
    from jsonb_each_text(p_targets) as target(asset_class, percentage)
    where target.percentage !~ '^[0-9]+([.][0-9]{1,6})?$'
  ) then
    raise exception using errcode = '22023', message = 'Target percentages must be decimal values';
  end if;

  if exists (
    select 1
    from jsonb_each_text(p_targets) as target(asset_class, percentage)
    where target.percentage::numeric < 0
      or target.percentage::numeric > 100
  ) then
    raise exception using errcode = '22023', message = 'Target percentages must be decimals from 0 to 100';
  end if;

  select sum(target.percentage::numeric)
  into v_total
  from jsonb_each_text(p_targets) as target(asset_class, percentage);

  if v_total <> 100 then
    raise exception using errcode = '23514', message = 'Target percentages must total exactly 100';
  end if;

  delete from public.wealth_allocation_targets
  where user_id = v_user_id;

  insert into public.wealth_allocation_targets (
    user_id,
    asset_class,
    target_percentage
  )
  select
    v_user_id,
    target.asset_class,
    target.percentage::numeric
  from jsonb_each_text(p_targets) as target(asset_class, percentage);
end;
$$;

revoke all on function public.replace_wealth_allocation_targets(jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_wealth_allocation_targets(jsonb)
  to authenticated;
