# Launch Readiness + Security Audit — Tharwati

Date: 2026-08-31
Branch `design-lab`. Project ref: `zpghalbnvcpaqjjtmgnq` (EU-West-2, account `aymnmoka94@gmail.com`).

## Method

Static review of all 42 migrations, 5 Edge Functions, and the React client, **plus live
introspection of the remote database via the Supabase MCP** (`list_tables`,
`get_advisors`, `list_edge_functions`, `list_migrations`, and direct `pg_catalog` /
`information_schema` queries). The following were verified live this pass:

- Table inventory + RLS-enabled flag (`list_tables`, `pg_class`).
- Every RLS policy predicate (`pg_policies`).
- Table/function privilege grants to `anon` / `authenticated` (`information_schema`, `pg_proc.proacl`).
- Every `SECURITY DEFINER` function's `search_path` setting (`pg_proc.proconfig`).
- Role `BYPASSRLS` attributes.
- Deployed Edge Functions + their `verify_jwt` flag.
- Supabase security + performance advisors.

Still **not** checked (needs the hosted dashboard): Auth provider settings beyond what the
advisor reports, SMTP config, Edge Function secret values, and an actual two-user runtime
test. Those remain in **§14**.

---

## Remediation status (2026-08-31, post-audit pass)

| ID | Status | Notes |
|----|--------|-------|
| F13 | ✅ **applied to prod** | Migration `20260831145907_lock_down_anon_and_authenticated_grants.sql` applied via MCP. Re-verified: `anon` now has **0** table grants; `authenticated` reduced to `SELECT/INSERT/UPDATE/DELETE` (no TRUNCATE/REFERENCES/TRIGGER). `FORCE RLS` deliberately NOT used — it would break the SECURITY DEFINER write paths. |
| F14 | ✅ **deployed** | `investment-fx` deployed (v1, ACTIVE, `verify_jwt = true`). Also made its `exchange_rates` cache write best-effort so cross-currency investments no longer hard-fail (F2 overlap). **Needs a logged-in add/edit-investment smoke test.** |
| F1 | ✅ **built** | `ForgotPasswordPage` + `ResetPasswordPage` + `requestPasswordReset` / `updatePassword` in `auth.service.ts`; "Forgot password?" link on `LoginPage`; `/forgot-password` + `/reset-password` routes; `PASSWORD_RECOVERY` handled in `App.tsx` (synchronous `#type=recovery` gate so the router can't bounce the user). UI verified in the browser; **end-to-end email round-trip still needs a real test** + hosted redirect-URL config (F4). |
| F5 | ⚠️ **partial** | Fixed the two clear leaks: `App.tsx` startup errors (now generic + `console.error`) and `investment-fx` RPC error (now `{error:"investment_request_rejected", code}` + server log). The broad `RepositoryError.message` surfacing across dialogs is a larger UX-sensitive refactor — still open. |
| F7 | ✅ **done** | `src/features/transactions/` (dead `TransactionsRepository`) deleted. |
| F10 | ✅ **done** | Stray `.tmp-*.sql` removed. |
| F11 | ✅ **done** | `.mcp.json` features trimmed to `docs,database,debugging,development,functions`. |
| F2 | ⚠️ **partial** | `investment-fx` no longer hard-depends on `exchange_rates`. The client-side `exchange_rates` / `currencies` dead code + stale generated types (26 files) is **not** touched — too entangled with dashboard/net-worth to do safely without a fuller pass. |
| F3 / F4 | ⏳ **you** | Hosted dashboard only — enable leaked-password protection, raise min length, enable email confirmation + CAPTCHA, set prod Site URL / redirect URLs, real SMTP. |
| F6 | ⏳ open | Needs the confirmed prod origin list before locking CORS on all 5 functions. |
| F8 | ⏳ open | Run the user-deletion cascade test. |
| F9 | ⏳ open | TanStack route tree is more entangled than first thought (`app-shell.tsx` + design-lab pages import `@tanstack/react-router`); left alone. |
| F12 | ✅ n/a | Informational — no action. |
| F15 | ⏳ open | Perf cleanup migration not written yet. |

Build ✅ · typecheck ✅ · 454 tests ✅ · no new lint errors (11 pre-existing on `design-lab`, untouched).

---

## Overall verdict

**Cross-user data isolation is solid — now verified live, not just from code.** The remote
`public` schema has **exactly the 20 tables of the migration chain**, all with
`rls_enabled = true`, and **zero policies granting `anon` or `public` any access** — every
one of the 34 policies targets `{authenticated}` with a `user_id = auth.uid()` (or
`user_id IS NULL` for shared catalog rows) predicate. `anon` and `authenticated` do **not**
have `BYPASSRLS`. Every `SECURITY DEFINER` function has an explicit `search_path` (0
exceptions), and **no `SECURITY DEFINER` function is executable by `anon`/`public`**. All 4
deployed Edge Functions have `verify_jwt = true`. So "User A sees User B's data" is blocked
at multiple layers.

**Not launch-ready.** Blockers / must-fix:

- **F1** — no password-reset flow (users get permanently locked out).
- **F14** — the `investment-fx` Edge Function is **not deployed**, but the client calls it
  for every add/edit investment → that feature is broken in production.
- **F13** — 8 tables still grant **full DML + TRUNCATE to `anon`** (legacy default).
  Contained today only by RLS-with-no-anon-policy; one bad migration from full exposure.
- **F3** — Auth hardening is off (leaked-password protection disabled, weak password rules,
  email confirmations off).
- **F5** — raw backend error strings surfaced to end users.

Schema drift (**F2**): the app still references `exchange_rates` / `currencies` tables that
do **not** exist on the remote — dead code + stale generated types.

---

## Findings by severity

| # | Severity | Area | Finding |
|---|----------|------|---------|
| F1 | **Blocker** | Auth | No password-reset / forgot-password flow anywhere in the client. Users who forget their password are permanently locked out. |
| F14 | **Blocker** | Edge deploy | `investment-fx` is in the repo but **not among the 4 deployed functions** (`list_edge_functions`). `src/features/investments/repositories/investments.repository.ts` calls `functions.invoke("investment-fx")` for **both add and edit investment** → those flows return 404 in production. Deploy it, or if investments are out of scope for launch, remove the function + client code. |
| F13 | **High** | Least privilege | 8 tables grant **ALL privileges (incl. `DELETE`, `TRUNCATE`) to `anon`**: `account_types`, `financial_accounts`, `profiles`, `account_valuations`, `account_disposals`, `goals`, `goal_progress_entries`, `metal_purchases`. Also `TRUNCATE`/`REFERENCES`/`TRIGGER` granted to `authenticated` on most tables. Not exploitable *today* (RLS on, no `anon` policy, PostgREST never emits TRUNCATE, `anon` lacks `BYPASSRLS`), but it removes all defense-in-depth: disabling RLS on one of these during a future migration, or adding one `TO public` / `USING (true)` policy, instantly exposes full read/write to the public anon key. Newer tables (`assets`, `holdings`, `financial_transactions`, …) already show the correct zero-`anon`-grant pattern. Fix with one `REVOKE` migration. |
| F2 | High (correctness) | Schema drift | `exchange_rates`, `exchange_rates_archive`, `currencies`, `financial_settings` **do not exist on the remote** (verified — only the 20 chain tables exist) — yet `src/lib/supabase/types.ts` still declares them and live code references them: `src/services/exchange-rates/repository.ts` (`.from("exchange_rates")` CRUD), `.from("currencies")` in `cash-accounts` + `exchange-rates` repos, Edge Functions `fx-rates` / `investment-fx` (`admin.from("exchange_rates")`). FX cache writes fail silently (caught); any live `.from("exchange_rates")` / `.from("currencies")` **read** returns a PostgREST error. Regenerate types, delete the dead table-access code. Latent risk: if `exchange_rates` is ever re-added, it must ship with RLS from day one. |
| F3 | High | Auth config | Advisor confirms **`auth_leaked_password_protection` is disabled**. Plus (`config.toml`) `minimum_password_length = 6`, `password_requirements = ""`, `enable_confirmations = false` (email not verified), no CAPTCHA. Weak for a financial app. |
| F4 | High | Auth config | Production Site URL / redirect allow-list must be confirmed in the hosted dashboard (config.toml only covers local dev; it lists only `127.0.0.1:5173`). Wrong values break password-reset/confirmation links or enable open-redirect. |
| F5 | High | Error handling | Raw backend error strings shown to end users: `App.tsx` startup error, all repository errors via `toRepositoryError`, and `investment-fx` returns `error.message` from the RPC straight to the client. Leaks schema / constraint / function names. |
| F6 | Medium | Edge/CORS | All Edge Functions send `Access-Control-Allow-Origin: *`. `fx-rates` sends **no** CORS headers and has no `OPTIONS` handler (inconsistent). Lock CORS to the app origin. |
| F7 | Low | Direct writes | `TransactionsRepository` does direct `.insert` on `financial_transactions` / `transaction_entries`, but it has **zero callers** and live grants show `authenticated` has only `SELECT` on both tables — so the path is doubly dead (no grant + no caller). Delete the class. |
| F8 | Medium | User deletion | `on delete cascade` is correct on every `auth.users` FK, and immutability triggers explicitly allow deletes when the `auth.users` row is gone. But several child FKs are `on delete restrict` (`transaction_entries.asset_id → assets`, `holdings.asset_id → assets`, `metal_purchases.*`). A full user delete cascades `assets` **and** `transaction_entries` from the same statement — verify an end-to-end user delete actually succeeds (§14 step 6). |
| F9 | Low | Repo hygiene | Dead TanStack Router tree (`src/routeTree.gen.ts`, `src/routes/*` incl. an **unguarded** `/` page and `design-lab` routes) is not mounted (`main.tsx` → `src/app/App.tsx`, react-router-dom). Remove to avoid a future accidental mount. |
| F10 | Low | Repo hygiene | Empty stray files `.tmp-record-category-remote.sql`, `.tmp-remote-account-records-schema.sql` in repo root. |
| F11 | Low | MCP scope | `.mcp.json` requests the Supabase MCP with `features=…,account,…,branching` — broader than needed for app work. |
| F12 | Info | Secrets | No secret material is committed. `.env` holds only `VITE_SUPABASE_URL` + anon key (both public by design); `.env` is git-ignored and never appeared in history. Service-role key is only read via `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` in Edge Functions — never shipped to the browser. |
| F15 | Low (perf, not security) | RLS perf | Advisor: 13× `auth_rls_initplan` — policies on `assets`, `holdings`, `transaction_entries`, `financial_transactions`, `record_categories`, `record_category_overrides`, `metal_purchase_lifecycle_events`, `asset_identifiers`, `dashboard_valuation_snapshots` call bare `auth.uid()` instead of `(select auth.uid())`, re-evaluated per row. Also 17 unindexed FKs, 4 unused indexes. Fold into one cleanup migration. |

3 non-`anon`-exposed `SECURITY INVOKER` helper functions (`get_account_current_ownership`,
`get_account_disposals`, `get_effective_account_valuations`) still have `EXECUTE` granted to
`anon`/`public`; harmless (invoker + underlying tables RLS'd + revoked from anon) but worth
tidying in the same `REVOKE` migration as F13.

---

## 1. RLS on every current table

**Live (`list_tables` + `pg_class`):** the remote `public` schema has **exactly the 20
migration-chain tables**, and **all 20 report `rls_enabled = true`**:
`account_types`, `transaction_types`, `asset_types`, `profiles`, `financial_accounts`,
`financial_transactions`, `transaction_entries`, `assets`, `asset_identifiers`, `holdings`,
`account_valuations`, `account_disposals`, `metal_purchases`,
`metal_purchase_lifecycle_events`, `market_prices`, `record_categories`,
`record_category_overrides`, `goals`, `goal_progress_entries`,
`dashboard_valuation_snapshots`.

`relforcerowsecurity = false` on all 20 — the Supabase default. Fine, because `anon` /
`authenticated` lack `BYPASSRLS`; consider `ALTER TABLE … FORCE ROW LEVEL SECURITY` as
extra hardening on the sensitive tables so even a future definer-function bug can't skip
RLS.

**No `exchange_rates` / `exchange_rates_archive` / `currencies` / `financial_settings` on
the remote** — see F2.

Write pattern per table: owner-scoped CRUD policies (`financial_accounts`, `assets`,
`record_categories`, `record_category_overrides`, `market_prices` [manual-only]) or
**select-own only** with all writes via `SECURITY DEFINER` RPC (`goals`,
`goal_progress_entries`, `account_valuations`, `account_disposals`, `holdings`,
`financial_transactions`, `transaction_entries`, `metal_purchases` [insert+select],
`metal_purchase_lifecycle_events`, `dashboard_valuation_snapshots`). Reference tables
(`account_types`, `transaction_types`, `asset_types`) are `select` where `is_active`.

**But grants don't match policies (F13):** `list_tables` RLS is on, yet
`information_schema.role_table_grants` shows 8 tables still granting **all privileges to
`anon`** and `TRUNCATE`/`REFERENCES`/`TRIGGER` to `authenticated`. RLS is the only thing
enforcing isolation on those — see §9.

## 1b. Live policy dump (`pg_policies`) — all 34 policies

- **Every policy targets `{authenticated}` only.** Zero policies mention `anon`, `public`,
  or an empty role set. Zero `USING (true)` / permissive-all policies.
- Predicates are all `auth.uid() = user_id` / `= id`, or `user_id IS NULL OR user_id =
  auth.uid()` for shared catalog rows (`assets`, `asset_identifiers`, `record_categories`,
  `market_prices`), with the `market_prices` manual-write policies additionally pinning
  `provider = 'manual'`, `price_type = 'manual'`, and asset visibility via `EXISTS`.
- `financial_transactions` / `transaction_entries` / `holdings` /
  `dashboard_valuation_snapshots` / `account_valuations` / `account_disposals` /
  `goals` / `goal_progress_entries` / `metal_purchase_lifecycle_events` expose **`SELECT`
  only** to `authenticated` (writes are RPC-only).
- Minor: some policies call bare `auth.uid()` instead of `(select auth.uid())` → perf
  advisor F15, not a security issue.

## 1c. Schema drift (F2)

The app still references `exchange_rates` / `currencies` / `financial_settings`
(`src/services/exchange-rates/`, `useExchangeRates`, `.from("currencies")`, stale generated
types) but those tables **do not exist on the remote** (only the 20 chain tables do). Not
an RLS gap today; a correctness bug + latent risk if re-added without RLS.

## 2. Can User A see User B's data?

**No — verified at the policy level (a runtime two-user test is still worth doing, §14-4).**
`pg_policies` confirms every policy is `{authenticated}` + `auth.uid()`-scoped with no
`anon`/`public`/`USING (true)` policy anywhere; `anon` and `authenticated` lack
`BYPASSRLS`; no `SECURITY DEFINER` function is `anon`-executable; the definer read RPCs
filter by `auth.uid()` internally.

- Owner-scoped tables: `using ((select auth.uid()) = user_id)`.
- Global/shared rows use `user_id IS NULL` (`assets` catalog, `market_prices` provider
  cache, `record_categories` system rows, `exchange_rates` provider rows) and policies
  read `user_id is null OR user_id = auth.uid()` — a user cannot mutate a shared row
  (`with check (user_id = auth.uid() …)`).
- `market_prices` is airtight: manual-only client writes, owner + asset-visibility
  checked, provider cache rows (`user_id IS NULL`) unreachable for update/delete.
- `SECURITY DEFINER` **read** RPCs filter internally:
  - `get_account_balances` → `where accounts.user_id = auth.uid()` (the `p_account_ids`
    param is AND-ed, not a bypass).
  - `get_account_record_history` → `v_user_id := auth.uid()`, raises if the account is
    not owned.
  - `get_account_lifecycle_eligibility` / `get_account_lifecycle_state` → owner-checked.
  - `store_dashboard_valuation_snapshot`, `create_goal`, `add_goal_progress_entry`,
    `close_financial_account`, … all derive the user from `auth.uid()`, never a param.

**Live confirmation still required (§14, step 4):** create two users, log in as A, attempt
to read B's `financial_accounts` / `goals` / `holdings` rows and call the RPCs with B's ids.

## 3. SECURITY DEFINER RPCs, GRANTs, search_path

- **~90 functions** across the chain. Spot-checks and greps show the invariant is
  consistently applied:
  - `security definer` **and** `set search_path = ''` (empty) on every definer function.
  - Fully schema-qualified object references (`public.…`, `pg_catalog.…`, `auth.users`).
  - `revoke all on function … from public, anon` (often also `authenticated`) followed by
    `grant execute … to authenticated` only for the caller-facing entrypoints.
  - Internal helpers (`*_internal`, trigger functions, `rebuild_holding_projection`,
    `validate_*`, `invalidate_dashboard_*`) are revoked from **all** roles and run only
    via trigger / nested call.
- Trigger functions that only shape a row (`set_updated_at`, `prepare_market_price_metadata`,
  `prevent_future_market_price`, `get_current_market_price`) are correctly
  `security invoker`.
- `complete_onboarding` moved from `invoker` → `definer` in a later migration; body updates
  only `where id = (select auth.uid())`. OK.

**Live verification (this pass):**
- `pg_proc.proconfig`: **0** `SECURITY DEFINER` functions in `public` are missing an
  explicit `search_path` setting.
- `pg_proc.proacl`: **0** `SECURITY DEFINER` functions are `EXECUTE`-able by `anon`/`public`.
  The only `anon`-executable functions are 5 `SECURITY INVOKER` ones —
  `get_account_current_ownership`, `get_account_disposals`,
  `get_effective_account_valuations` (read RLS'd tables → return nothing for `anon`), and
  the `set_updated_at` / `prevent_legacy_non_market_opening_balance_write` trigger funcs
  (need trigger context). Tidy the 3 `get_*` grants anyway.
- Advisor raises `authenticated_security_definer_function_executable` **38×** — one per
  caller-facing RPC (`add_*`, `create_*`, `close_*`, `get_*`). Expected by design; each
  scopes to `auth.uid()` internally. Worth a one-time review to confirm every one is
  intended.

## 4. Protected routes

- Live app = `src/app/App.tsx` (react-router-dom). `ProtectedRoute` gates the dashboard
  subtree on `session` truthiness and redirects to `/login`; `/onboarding` gated on
  `session` + `onboarding_completed`; `/login` and `/signup` bounce authed users out.
- This is **client-side only** and that is acceptable — the real boundary is RLS. No route
  exposes data without an authenticated Supabase call behind it.
- **F9:** the unused TanStack route tree contains a public unguarded `/` page. It is not
  mounted today; delete it so it can't be wired up by mistake.

## 5. Supabase Auth / session / login / logout

- `signInWithPassword`, `signUp`, `signOut` (global scope) via `auth.service.ts`. Standard.
- Client created with default options → `persistSession` + `autoRefreshToken` +
  `detectSessionInUrl` on, session in `localStorage`. Normal for an SPA; acceptable.
- `onAuthStateChange` handled; `canPreserveAuthenticatedTree` keeps the tree mounted across
  token refresh for the same user id — fine.
- `jwt_expiry = 3600`, refresh-token rotation on, reuse interval 10s — good.
- No `[auth.sessions]` timebox / inactivity timeout configured — consider one for a
  financial app.

## 6. Password reset & Auth-related settings

- **F1 — missing entirely.** No `resetPasswordForEmail`, no `updateUser({password})`, no
  "forgot password" link. Add: request screen → email link → `/reset-password` route that
  calls `supabase.auth.updateUser({ password })` after the recovery session is detected.
- **F3 — weak policy:** `minimum_password_length = 6`; `password_requirements = ""`;
  `enable_confirmations = false` (users sign in without proving email ownership — and the
  SignUpPage "check your email" branch is dead code under this setting);
  `[auth.captcha]` disabled; `secure_password_change = false`.
  Recommend: length ≥ 8–10, `lower_upper_letters_digits`, enable email confirmation,
  enable Turnstile/hCaptcha, `secure_password_change = true`, and leaked-password
  protection (HIBP) in the hosted dashboard.
- **F4:** confirm hosted **Site URL** and **Redirect URLs** = the real Vercel domain(s)
  only. `config.toml` (local only) currently lists just `127.0.0.1:5173`.
- `rate_limit` block is present and reasonable (`email_sent = 2`,
  `sign_in_sign_ups = 30 / 5min`, `token_refresh = 150`).

## 7. Edge Functions — deploy state, secrets, service-role key

- **Deployed (live, `list_edge_functions`): 4 — `asset-search`, `market-prices`,
  `dashboard-valuation`, `fx-rates`. All have `verify_jwt = true`.** ✅
- **`investment-fx` is NOT deployed (F14).** The repo has it; the client calls it for add
  and edit investment. Those flows 404 in prod. Deploy or remove.
- Service-role key: used only in `market-prices`, `fx-rates`, (`investment-fx`) via
  `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`, always for an `admin` client that touches
  **only global rows** (`market_prices` provider cache `user_id: null`; `exchange_rates`
  provider rows — which no longer exist, so those admin calls are dead). All user-scoped
  work uses the caller-scoped `userClient`. Admin client is never combined with a
  user-controlled row filter → no escalation path. Not exposed to the browser.
- Every function also checks the `Authorization` header **and** `userClient.auth.getUser()`
  before doing work — belt-and-suspenders over `verify_jwt`.
- **Still verify (§14-7):** Edge secrets list shows only `SUPABASE_*` (auto) +
  `TWELVE_DATA_API_KEY`, nothing stray.
- `console.error(... error.message ...)` in functions → server logs only — fine.

## 8. CORS / environment variables

- **F6:** `Access-Control-Allow-Origin: "*"` on `dashboard-valuation`, `market-prices`,
  `investment-fx`, `asset-search`. Risk is limited (these require a Bearer JWT, which is
  not sent cross-origin automatically), but tighten to the app origin.
  `fx-rates` returns JSON with **no CORS headers and no OPTIONS handler** — make it
  consistent with the others.
- Env: client build only reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
  (`src/lib/supabase/client.ts`, throws if missing). No other `import.meta.env` reads of
  secrets. `vercel.json` is an SPA rewrite only. Confirm Vercel project env vars match and
  contain nothing sensitive.

## 9. Grants & direct table writes

### 9a. Live grant audit (`information_schema.role_table_grants`) — **F13**

| Grantee | Tables | Privileges | Verdict |
|---------|--------|------------|---------|
| `anon` | `account_types`, `financial_accounts`, `profiles`, `account_valuations`, `account_disposals`, `goals`, `goal_progress_entries`, `metal_purchases` | **DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE** | ❌ legacy blanket grant — must be revoked |
| `anon` | all other 12 tables | (none) | ✅ correct |
| `authenticated` | most tables | includes `TRUNCATE`, `REFERENCES`, `TRIGGER` | ❌ strip these |
| `authenticated` | `financial_transactions`, `transaction_entries`, `holdings`, `dashboard_valuation_snapshots`, `asset_types`, `asset_identifiers` | `SELECT` only | ✅ correct |
| `authenticated` | `assets` | `DELETE, INSERT, SELECT, UPDATE` | ✅ this is the target shape |

Why it's contained today (not a live breach): RLS is enabled on every table, **no policy
grants `anon` anything**, PostgREST never issues `TRUNCATE`, and `anon`/`authenticated`
lack `BYPASSRLS`. Why it still matters: it's the entire safety margin. `DISABLE ROW LEVEL
SECURITY` in one future migration, or one `CREATE POLICY … TO public USING (true)`, and the
public anon key has full read/write on `financial_accounts` and `profiles`.

### 9b. Client `.insert/.update/.delete/.upsert` inventory

| Table | Client writes? | Guard (verified) |
|-------|----------------|-------|
| `financial_accounts` | insert/update | RLS owner CRUD; `authenticated` has no `DELETE` (lifecycle RPC only); lifecycle trigger blocks direct `is_active`/`closed_*` |
| `assets` | insert/update/delete | RLS `with check (user_id = auth.uid() and is_custom)` |
| `record_categories` / `record_category_overrides` | insert/update/upsert/delete | RLS owner + `system_code IS NULL` guard |
| `market_prices` | insert/update/upsert | RLS manual-only, owner + asset-visibility (policy dump confirms) |
| `exchange_rates` | CRUD | **Table absent (F2)** — errors / silently caught. Delete the code. |
| `financial_transactions` / `transaction_entries` | via `TransactionsRepository` | **Doubly dead:** zero callers **and** `authenticated` has only `SELECT` (no INSERT/UPDATE/DELETE grant). Delete the class. |
| `profiles` | update | RLS `update_own`; bootstrap via `handle_new_user` definer trigger |

## 10. User deletion / cascade

- Every `user_id → auth.users(id)` FK in the active chain is `ON DELETE CASCADE`
  (including `goals`, which was missing its FK and got it in
  `20260829133000_fix_goals_user_deletion_cascade.sql`).
- Child chains cascade: `transaction_entries → financial_transactions`, `holdings →
  financial_accounts`, `goal_progress_entries → goals`, `record_category_overrides →
  record_categories`, etc.
- Immutability triggers are deletion-aware by design — `prevent_posted_transaction_changes`,
  `prevent_posted_transaction_entry_changes`, `prevent_goal_progress_mutation`,
  `prevent_posted_account_record_changes` all permit the row delete when the owning
  `auth.users` row no longer exists (documented in their `COMMENT`s).
- **F8 — verify:** `assets` (custom, user-owned) is `ON DELETE CASCADE` from `auth.users`,
  but `transaction_entries.asset_id` and `holdings.asset_id` reference `assets` `ON DELETE
  RESTRICT`. In a single `DELETE FROM auth.users` both sides cascade; RESTRICT is checked
  immediately. Run an actual user-delete against a fully-populated test user (§14, step 5)
  to confirm it doesn't abort.
- There is **no in-app account-deletion feature** (only per-financial-account
  `delete_pristine_financial_account`). Deleting a user = Supabase dashboard / Admin API.
  If self-serve account closure is a launch requirement, it's not built.

## 11. Migration history & remote state

- `supabase migration list` **and** MCP `list_migrations` (this pass): **all 42 SQL
  migrations present locally are applied remotely**, same order, no drift, nothing
  remote-only. `.test.ts` files in the migrations dir are correctly skipped.
- `supabase/legacy-migrations/pre-august-baseline/` (24 files) is explicitly out of the
  chain (see its README) and must not be replayed. The remote contains **only** the 20
  tables the active chain builds (verified) — the repo's migrations fully describe
  production. The `exchange_rates` family from those legacy files is **not** on the remote
  (F2); treat the leftover references as code to delete, not schema to reconcile.
- `config.toml` `[experimental.pgdelta] enabled = true` — the newer diff engine; fine, just
  note it if you do `db pull`/`db diff` for the F2 reconciliation.

## 12. Error handling / technical-detail exposure

- **F5:**
  - `src/app/App.tsx` — `setStartupError(error.message)` and `supabase.auth.getSession()`
    `error.message` are rendered verbatim in the "We couldn't load your account" card.
  - `src/lib/supabase/repository.ts` + `toRepositoryError` — PostgREST/Postgres messages
    (constraint names, `column … does not exist`, function signatures) propagate to
    `LoginPage`/`SignUpPage`/dialogs as `error.message`.
  - `supabase/functions/investment-fx/index.ts:757` — `return response({ error: error.message }, 422)`
    returns the raw RPC error to the browser.
  - Auth pages: Supabase's own auth strings ("Invalid login credentials") are safe; the
    concern is DB/RPC errors reaching the same channel.
- Good: `dashboard-valuation` and `market-prices` return opaque codes
  (`dashboard_valuation_unavailable`, `market_prices_request_failed`) and log details
  server-side only. Do the same everywhere: map known error codes to friendly copy, log
  the raw error with a correlation id, and return a generic message + id to the user.

## 13. Positives (verified live)

- 20/20 tables `rls_enabled`; 34/34 policies `{authenticated}` + `auth.uid()`-scoped; **0**
  `anon`/`public`/`USING (true)` policies.
- **0** `SECURITY DEFINER` functions missing `search_path`; **0** executable by
  `anon`/`public`.
- `anon` / `authenticated` lack `BYPASSRLS`.
- 4/4 deployed Edge Functions have `verify_jwt = true`; each also verifies the JWT in code.
- Migrations fully in sync, no drift.
- No `security_definer_view`, no `rls_disabled_in_public`, no policy-less RLS table in the
  security advisor.
- Server-authoritative lifecycle (posting, close/reopen/delete, disposals, corrections);
  immutable cascade-aware audit history.
- No secrets in the repo or git history; service-role key confined to Edge runtime.

---

## 14. Live verification — status

| # | Check | Result this pass |
|---|-------|------------------|
| 1 | Table inventory + `rls_enabled` (`list_tables` / `pg_class`) | ✅ 20/20 tables, all RLS-enabled; `relforcerowsecurity = false` (default) |
| 2 | Policy inventory (`pg_policies`) | ✅ 34 policies, all `{authenticated}` + `auth.uid()`; 0 `anon`/`public`/`USING(true)` |
| 3 | Function `search_path` + ACL (`pg_proc`) | ✅ 0 definer fns missing `search_path`; 0 definer fns `anon`-executable; 3 invoker `get_*` fns have stray `anon` EXECUTE (tidy) |
| 4 | Table grants to `anon` (`information_schema`) | ❌ **F13** — 8 tables grant ALL to `anon`; `TRUNCATE`/`REFERENCES`/`TRIGGER` to `authenticated` |
| 5 | Role `BYPASSRLS` | ✅ `anon`, `authenticated`, `authenticator` = false; `service_role`, `postgres` = true (standard) |
| 6 | Edge Functions + `verify_jwt` (`list_edge_functions`) | ✅ 4 deployed, all `verify_jwt = true`; ❌ **F14** `investment-fx` not deployed |
| 7 | Migrations (`list_migrations`) | ✅ in sync, no drift |
| 8 | Security advisor (`get_advisors`) | 38× `authenticated_security_definer_function_executable` (by design); 1× `auth_leaked_password_protection` disabled (**F3**) |
| 9 | Perf advisor | 13× `auth_rls_initplan`, 17 unindexed FKs, 4 unused indexes (**F15**) |

### Still to run (needs hosted dashboard / two test users)

- **Two-user runtime test:** as user A, `select * from financial_accounts` / `goals`
  (only A's rows); `select get_account_balances(array['<B-account>']::uuid[])` (empty);
  `update market_prices set price = 1 where user_id is null` (0 rows).
- **User-deletion cascade:** populate test user B fully, then `delete from auth.users where
  id = '<B>'` — confirm it completes and leaves 0 rows for B (checks F8 RESTRICT chains).
- **Hosted Auth (dashboard → Authentication):** Site URL + Redirect URLs = production
  domain only; enable email confirmations; min password length ≥ 8; enable leaked-password
  protection + CAPTCHA; real SMTP sender (config.toml still points at the local test SMTP).
- **Edge secrets:** confirm only `SUPABASE_*` (auto) + `TWELVE_DATA_API_KEY`.
- **DB network:** confirm hosted network restrictions / SSL enforcement match intent.

---

## 15. Recommended pre-launch fix order

1. **F1** Build password-reset (request screen + `/reset-password` route + `updateUser`).
2. **F14** Deploy `investment-fx` (`supabase functions deploy investment-fx`) — or, if
   investments aren't launching, remove the function and `investments.repository.ts` calls.
3. **F13** Apply the `REVOKE` migration in §16.
4. **F3 / F4** Hosted Auth hardening + production redirect URLs + real SMTP.
5. **F5** Stop surfacing raw backend errors — generic message + logged correlation id; fix
   `investment-fx/index.ts:757`.
6. **F2** Regenerate `src/lib/supabase/types.ts`; delete the `exchange_rates` /
   `currencies` table-access code and the dead admin-client cache writes.
7. **F6** Lock Edge CORS to the app origin; give `fx-rates` a consistent CORS/OPTIONS path.
8. **F8** Run the user-deletion cascade test; fix any RESTRICT chain that aborts it.
9. **F7 / F9 / F10 / F11 / F15** Delete `TransactionsRepository`, dead TanStack route tree,
   stray `.tmp-*.sql`; trim `.mcp.json` scope; fold the `(select auth.uid())` +
   FK-index cleanup into one migration.
10. Re-run the §14 runtime tests and attach results to the launch ticket.

---

## 16. Ready-to-apply migration for F13

```sql
-- supabase/migrations/<ts>_lock_down_anon_and_authenticated_grants.sql
-- Remove the legacy blanket grants. RLS already denies anon everything; this
-- removes the standing privilege so a future RLS mistake cannot expose data.

revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;

-- authenticated keeps only what the app + PostgREST actually use.
revoke truncate, references, trigger
  on all tables in schema public from authenticated;

-- Stray EXECUTE on 3 SECURITY INVOKER helpers (harmless but untidy).
revoke execute on function
  public.get_account_current_ownership(uuid[]),
  public.get_account_disposals(uuid[]),
  public.get_effective_account_valuations(uuid[])
  from anon, public;

-- Make future auto-grants stop happening.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
```

After applying, re-run §14 check 4 — `anon` should return **zero** rows, and
`authenticated` should show only `SELECT` (+ `INSERT/UPDATE/DELETE` where the app writes
directly: `financial_accounts`, `assets`, `record_categories`, `record_category_overrides`,
`market_prices`, `profiles`). Smoke-test the app afterward (dashboard load, add account,
add record, goals) since this touches every table's ACL.

Optional hardening: `alter table public.financial_accounts, public.profiles,
public.financial_transactions, public.transaction_entries, public.goals,
public.goal_progress_entries force row level security;` so definer-function bugs can't skip
RLS either.
