-- Holdings are a derived cache. Browser roles may read through RLS, but only
-- trusted projection functions may change projection rows.
drop policy if exists holdings_insert_own on public.holdings;
drop policy if exists holdings_update_own on public.holdings;
drop policy if exists holdings_delete_own on public.holdings;

revoke insert, update, delete
  on table public.holdings
  from public, anon, authenticated;

revoke select
  on table public.holdings
  from public, anon;

grant select
  on table public.holdings
  to authenticated;

-- The projection writer is internal. It is SECURITY DEFINER with an empty
-- search_path and is reached only from the authenticated posting functions,
-- which validate ownership before supplying the user scope.
revoke all on function public.rebuild_holding_projection(
  uuid, uuid, uuid, uuid
) from public, anon, authenticated;

comment on table public.holdings is
  'Client-read-only projection rebuilt from posted ledger effects. Authenticated users may select only their own rows through RLS; browser roles have no direct write privileges.';
