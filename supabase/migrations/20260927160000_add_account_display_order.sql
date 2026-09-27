-- Presentation order is independent of financial account metadata and values.
-- The composite key makes ownership of every ordering row a database invariant.
alter table public.financial_accounts
  add constraint financial_accounts_id_user_id_key unique (id, user_id);

create table public.account_display_order (
  account_id uuid primary key,
  user_id uuid not null,
  position integer not null check (position > 0),
  constraint account_display_order_account_owner_fkey
    foreign key (account_id, user_id)
    references public.financial_accounts (id, user_id) on delete cascade,
  constraint account_display_order_user_position_key
    unique (user_id, position) deferrable initially immediate
);

-- Approximate the existing Name ascending default. ID resolves name ties.
insert into public.account_display_order (account_id, user_id, position)
select id, user_id,
  row_number() over (partition by user_id order by lower(name) collate "C", id)::integer
from public.financial_accounts;

alter table public.account_display_order enable row level security;
create policy account_display_order_select_own
  on public.account_display_order for select to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.account_display_order from public, anon, authenticated;
grant select on public.account_display_order to authenticated;

-- Ordered accounts first; accounts created after the backfill have no row and
-- appear at the end in creation order until a user saves another Custom order.
create function public.get_account_custom_order()
returns uuid[]
language sql stable security invoker set search_path = ''
as $$
  select coalesce(
    array_agg(a.id order by o.position nulls last, a.created_at, a.id),
    '{}'::uuid[]
  )
  from public.financial_accounts a
  left join public.account_display_order o
    on o.account_id = a.id and o.user_id = a.user_id
  where a.user_id = (select auth.uid());
$$;

revoke all on function public.get_account_custom_order() from public, anon;
grant execute on function public.get_account_custom_order() to authenticated;

create function public.reorder_accounts(
  p_expected_ids uuid[], p_ordered_ids uuid[]
)
returns uuid[]
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current uuid[];
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_ordered_ids is null then
    raise exception 'ordered account IDs are required' using errcode = '22023';
  end if;

  -- FK inserts into financial_accounts take a KEY SHARE lock on this user.
  -- FOR UPDATE waits for those inserts and blocks new ones until commit.
  perform 1 from auth.users where id = v_user_id for update;
  if not found then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  -- Existing account deletes cannot race validation or the order write.
  perform a.id from public.financial_accounts a
    where a.user_id = v_user_id order by a.id for share of a;
  v_current := public.get_account_custom_order();

  -- Multiset equality rejects foreign, duplicate, missing, and null IDs.
  if array(select account_id from unnest(p_ordered_ids) as input(account_id) order by account_id)
     is distinct from
     array(select account_id from unnest(v_current) as input(account_id) order by account_id) then
    raise exception 'ordered IDs must contain every owned account exactly once'
      using errcode = '22023';
  end if;

  -- Successful replay takes precedence over stale expected IDs.
  if v_current = p_ordered_ids then
    return v_current;
  end if;
  if p_expected_ids is distinct from v_current then
    raise exception 'account order changed; reload before reordering'
      using errcode = 'PT409';
  end if;

  set constraints public.account_display_order_user_position_key deferred;
  update public.account_display_order o
    set position = ids.ordinality::integer
    from unnest(p_ordered_ids) with ordinality as ids(id, ordinality)
    where o.account_id = ids.id and o.user_id = v_user_id;

  insert into public.account_display_order (account_id, user_id, position)
  select ids.id, v_user_id, ids.ordinality::integer
    from unnest(p_ordered_ids) with ordinality as ids(id, ordinality)
    where not exists (
      select 1 from public.account_display_order o where o.account_id = ids.id
    );

  return p_ordered_ids;
end;
$$;

revoke all on function public.reorder_accounts(uuid[], uuid[]) from public, anon;
grant execute on function public.reorder_accounts(uuid[], uuid[]) to authenticated;
