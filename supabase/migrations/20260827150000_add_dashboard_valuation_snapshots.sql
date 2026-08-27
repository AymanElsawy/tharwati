create table public.dashboard_valuation_snapshots (
  user_id uuid not null references auth.users (id) on delete cascade,
  base_currency_code text not null
    constraint dashboard_valuation_snapshots_base_currency_code_check
    check (base_currency_code in ('USD', 'SAR', 'EGP', 'EUR', 'GBP')),
  snapshot jsonb not null,
  as_of timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, base_currency_code),
  constraint dashboard_valuation_snapshots_expiry_check check (expires_at > as_of)
);

alter table public.dashboard_valuation_snapshots enable row level security;

create policy dashboard_valuation_snapshots_select_own
  on public.dashboard_valuation_snapshots
  for select to authenticated
  using (user_id = auth.uid());

create or replace function public.store_dashboard_valuation_snapshot(
  p_base_currency_code text,
  p_snapshot jsonb,
  p_as_of timestamptz,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing jsonb;
  v_expires_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_base_currency_code !~ '^[A-Z]{3}$' or p_snapshot is null
    or p_as_of is null or p_expires_at is null or p_expires_at <= p_as_of then
    raise exception 'invalid dashboard valuation snapshot' using errcode = '22023';
  end if;

  select snapshot, expires_at into v_existing, v_expires_at
  from public.dashboard_valuation_snapshots
  where user_id = v_user_id and base_currency_code = p_base_currency_code
  for update;

  if found and v_expires_at > now() then
    return v_existing;
  end if;

  insert into public.dashboard_valuation_snapshots (
    user_id, base_currency_code, snapshot, as_of, expires_at
  ) values (
    v_user_id, p_base_currency_code, p_snapshot, p_as_of, p_expires_at
  )
  on conflict (user_id, base_currency_code) do update set
    snapshot = excluded.snapshot,
    as_of = excluded.as_of,
    expires_at = excluded.expires_at,
    updated_at = now();

  return p_snapshot;
end;
$$;

revoke all on table public.dashboard_valuation_snapshots from public, anon, authenticated;
grant select on public.dashboard_valuation_snapshots to authenticated;
revoke all on function public.store_dashboard_valuation_snapshot(text, jsonb, timestamptz, timestamptz) from public, anon;
grant execute on function public.store_dashboard_valuation_snapshot(text, jsonb, timestamptz, timestamptz) to authenticated;
