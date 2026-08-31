-- Launch-readiness security fix (audit finding F13).
--
-- Several older tables still carry the legacy Supabase default that granted
-- ALL privileges (including DELETE and TRUNCATE) to `anon`, plus
-- TRUNCATE/REFERENCES/TRIGGER to `authenticated`. RLS already denies `anon`
-- every row, but that standing privilege is the entire safety margin: one
-- future `disable row level security` or a `to public using (true)` policy
-- would expose full read/write through the public anon key.
--
-- This migration removes those standing privileges. The newer tables in this
-- schema were already created with `revoke all ... from public, anon`, so the
-- blanket revoke below is a no-op for them and simply makes the whole schema
-- consistent.
--
-- NOTE: we deliberately do NOT `force row level security` here. Every write
-- path in this schema is a SECURITY DEFINER function that owns the table and
-- relies on not being subject to RLS (the user-owned tables expose only
-- `select ... using (user_id = auth.uid())` policies, with no INSERT/UPDATE
-- policy). Forcing RLS would break onboarding, goals, valuations, posting, etc.

revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;

-- `authenticated` keeps only the DML the app and PostgREST actually use
-- (SELECT everywhere, plus INSERT/UPDATE/DELETE on the handful of tables the
-- client writes directly). It never needs table-owner privileges.
revoke truncate, references, trigger
  on all tables in schema public from authenticated;

-- Three SECURITY INVOKER helper functions still had EXECUTE granted to
-- anon/public. They only read RLS-protected tables (so anon gets nothing),
-- but the grant is unnecessary.
revoke execute on function
  public.get_account_current_ownership(uuid[]),
  public.get_account_disposals(uuid[]),
  public.get_effective_account_valuations(uuid[])
  from anon, public;

-- Stop future objects created in `public` from auto-granting to anon.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
