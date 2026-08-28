-- RLS policies define authenticated own-row access, but policies do not grant
-- the underlying table privileges. Make that boundary explicit so behavior is
-- independent of environment-specific default privileges.
revoke select, insert, update, delete
on table public.financial_accounts
from anon;

grant select, insert, update, delete
on table public.financial_accounts
to authenticated;

comment on table public.financial_accounts is
  'User-owned financial accounts. Authenticated CRUD is restricted to the owning user by RLS.';
