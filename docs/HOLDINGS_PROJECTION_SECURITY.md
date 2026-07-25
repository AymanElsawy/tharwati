# Holdings Projection Security

`public.holdings` is a read-only derived projection for browser clients.

- `INSERT`, `UPDATE`, and `DELETE` privileges are revoked from both `anon` and
  `authenticated`.
- Authenticated users retain `SELECT` access only to rows owned by
  `auth.uid()` through Row Level Security.
- Anonymous users cannot read holdings.
- Only the trusted ledger-posting and holding-projection path may create,
  update, or delete holding rows.
- Migration
  `20260726003000_make_holdings_projection_client_read_only.sql` was applied
  successfully to the linked Supabase project.
- The real two-user PostgreSQL security suite
  `supabase/tests/holdings_projection_security.sql` passed all 10 assertions
  against a disposable local Supabase PostgreSQL environment.
- Test Auth and financial fixtures are transaction-scoped and roll back after
  execution.
- The pending-transaction cleanup correction in
  `20260726013000_preserve_pending_holding_projection_cleanup.sql` remains
  local-only until it is applied separately to a linked environment.
