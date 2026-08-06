# Tharwati Phase 2 Financial Data Architecture — Implementation Plan

Version: 1.0  
Status: Proposed for review  
Scope: Net-worth and financial tracking foundation  

## Purpose

This plan converts the approved Phase 2 financial data architecture into small, reviewable implementation stages. It does not authorize database or application changes by itself. Each stage should be reviewed and approved before implementation.

Phase 2 keeps React Router, `DashboardLayout`, `ThemeContext`, Supabase authentication, and the current dashboard UI. The dashboard must remain mock-driven until the live data layer is complete, secured, tested, and verified against known fixtures.

## Governing principles

- PostgreSQL/Supabase is authoritative for financial calculations.
- Native financial values are never overwritten by reporting-currency values.
- Cash balances derive from the cash ledger.
- Non-cash asset values derive from append-only valuations.
- Liability values derive from append-only balance records.
- Stock purchases are not generic expenses. Investment positions are tracked separately from ordinary cash spending.
- Every user-owned table has RLS, a direct `user_id`, and same-user ownership constraints for parent-child relationships.
- Missing exchange rates never default to `1`; calculations return an incomplete status and structured warnings.
- The MVP supports manual portfolios and positions but defers trades, lots, dividends, and automated pricing.
- Historical snapshots are derived records with calculation versioning and auditable components.
- Schema changes are reproducible migrations committed to version control.

---

# Phase 2.0 — Decisions and prerequisites

## Objective

Resolve the decisions that affect schema semantics and confirm that local and remote environments can be changed safely before creating Supabase files.

## Database objects

None.

## Application files

Documentation only. No source files should change.

## Exact implementation tasks

1. Approve the initial supported currency list and default currency.
2. Approve exchange-rate source, refresh frequency, historical-rate availability, and licensing.
3. Confirm the account balance rule: balances are transaction-derived and initial balances are opening-balance transactions.
4. Approve transaction sign convention: positive increases cash; negative decreases cash.
5. Confirm that a stock purchase creates a portfolio-position update plus a linked cash movement, not an expense transaction.
6. Decide whether portfolio positions store manual total value, quantity and manual unit price, or both. Recommended: quantity, optional unit price, and authoritative manual market value.
7. Approve asset and liability correction rules: append a new record by default; explicit correction or deletion remains possible.
8. Approve goal progress methods: `net_worth`, `account_balance`, and `manual_contributions`.
9. Approve snapshot cadence and cutoff timezone. Recommended: daily per profile timezone and refresh the current day after mutations.
10. Decide how reporting-currency changes affect history. Recommended: preserve old snapshots and require explicit regeneration.
11. Decide whether incomplete snapshots are stored. Recommended: store them with warnings so gaps are visible and auditable.
12. Inventory the linked Supabase project, current remote schema, existing migrations, and environments.
13. Confirm backups or point-in-time recovery appropriate to the existing remote environment.
14. Record the current database schema before any future pull or push.

## Dependencies

- Product owner approval
- Access to the existing Supabase project
- Knowledge of whether remote schema changes already exist
- Docker-compatible local runtime for the Supabase stack

## Validation commands

Commands to run only during implementation:

```bash
npx supabase --version
npx supabase projects list
npx supabase migration list
git status --short
```

## Tests

- Decision checklist review
- Environment ownership review
- Confirm no secrets are committed
- Confirm the target project reference before any linked command

## Risks

- Starting migrations before inspecting remote state can create schema drift.
- Ambiguous currency or position semantics can force destructive redesign.
- Running reset commands against a linked environment can destroy data.

## Rollback strategy

No technical rollback is needed because this phase is documentation and verification only. Reject or revise decisions before proceeding.

## Exit criteria

- Every listed product decision has an approved answer.
- Remote schema and migration state are known.
- Backup and recovery capabilities are documented.
- Local prerequisites are available.
- No source, configuration, or database changes have been made.

## Suggested Git commit message

```text
docs: approve Phase 2 financial data prerequisites
```

---

# Phase 2.1 — Supabase local foundation

## Objective

Create a reproducible local Supabase workflow without changing the financial schema or production data.

## Database objects

None beyond Supabase local system objects.

## Application files

Expected future changes:

```text
supabase/config.toml
supabase/seed.sql
supabase/migrations/.gitkeep
.gitignore
package.json                         # only if conventional helper scripts are approved
docs/                               # workflow documentation
```

## Exact implementation tasks

1. Install or invoke a pinned Supabase CLI version without changing unrelated package versions.
2. Run `supabase init` at the root.
3. Review generated local ports and auth settings.
4. Keep credentials in environment variables; do not add secrets to `config.toml`.
5. Choose imperative timestamped migrations as the migration strategy.
6. Create an initially empty, deterministic seed file.
7. Define local, staging, and production command conventions.
8. Pull the remote schema only if Phase 2.0 confirms pre-existing remote objects must be captured.
9. Document that `db reset --linked` is prohibited for production.
10. Add optional scripts only if approved, such as `db:start`, `db:reset`, and `db:types`.

## Dependencies

- Phase 2.0 complete
- Docker-compatible runtime
- Supabase CLI
- Confirmed remote project ownership

## Validation commands

```bash
npx supabase start
npx supabase status
npx supabase db reset --local
npx supabase migration list --local
git status --short
```

## Tests

- A fresh local stack starts successfully.
- A local reset completes with no migrations.
- Seed execution is idempotent or reset-safe.
- No secrets appear in tracked files.

## Risks

- CLI-generated configuration may accidentally conflict with existing ports.
- Pulling from the wrong remote project may capture an unrelated schema.
- Unpinned CLI behavior can change between developers.

## Rollback strategy

Stop the local stack and revert only the newly added Supabase local files. No remote rollback should be necessary because no push occurs.

## Exit criteria

- A fresh clone can start and reset the local Supabase stack.
- Migration and seed locations are established.
- No financial tables exist yet.
- No remote environment was mutated.

## Suggested Git commit message

```text
chore: initialize local Supabase workflow
```

---

# Phase 2.2 — Reference and profile layer

## Objective

Introduce currency reference data, one financial profile per authenticated user, and separate long-term financial assumptions.

## Database objects

- `public.currencies`
- `public.profiles`
- `public.financial_settings`
- Updated-at trigger function if approved
- Profile creation function or trigger
- RLS policies and indexes

## Application files

Expected future changes:

```text
supabase/migrations/<timestamp>_create_reference_and_profile_layer.sql
supabase/seed.sql
supabase/tests/profile_layer.sql
```

No React files are required in this stage.

## Exact implementation tasks

1. Create `currencies` with ISO code, name, symbol, minor unit, and active status.
2. Seed only approved currencies.
3. Create `profiles` with `user_id` as PK/FK to `auth.users`, locale, timezone, and reporting currency.
4. Create `financial_settings` with:
   - `user_id` PK/FK
   - `preferred_reporting_currency_code`
   - `retirement_age`
   - `expected_annual_return`
   - `inflation_rate`
   - `safe_withdrawal_rate`
   - timestamps
5. Define rates as decimal fractions, for example `0.07 = 7%`.
6. Add checks for realistic storage ranges without imposing product advice:
   - retirement age within an approved broad range
   - return and inflation bounded to prevent malformed input
   - safe withdrawal rate nonnegative and bounded
7. Decide and implement profile creation:
   - Recommended: trigger on `auth.users` creates minimal profile and settings rows.
   - Trigger must be defensive because a failing trigger can block signup.
8. Make `profiles.base_currency_code` and `financial_settings.preferred_reporting_currency_code` consistent initially.
9. Define which setting is authoritative. Recommended: `financial_settings.preferred_reporting_currency_code`; keep profile currency only if needed for onboarding. Avoid two long-term sources.
10. Enable RLS.
11. Allow authenticated users to select/update only their own profile/settings.
12. Disallow client mutation of `user_id`.
13. Allow authenticated read-only access to active currencies.

## Dependencies

- Phase 2.1 complete
- Approved default and supported currencies
- Approved profile creation strategy

## Validation commands

```bash
npx supabase db reset --local
npx supabase test db
npx supabase db lint --local
```

## Tests

- Signup produces exactly one profile and settings row.
- Duplicate profile/settings rows are rejected.
- User A cannot read or change User B’s rows.
- Anonymous users cannot access profile/settings data.
- Currency-code and assumption constraints reject malformed values.
- Deleting an Auth user cascades as approved.

## Risks

- A profile trigger error can break signup.
- Duplicating reporting currency across two tables can violate one-source-of-truth.
- Financial defaults may be perceived as advice; defaults must be conservative and clearly editable.

## Rollback strategy

Drop policies, trigger, settings, profile, and currency objects in reverse dependency order in a compensating migration. Do not edit an applied production migration.

## Exit criteria

- Profile/settings creation works for new users.
- RLS isolation passes two-user tests.
- Reporting-currency authority is unambiguous.
- Local reset and database lint pass.

## Suggested Git commit message

```text
feat(db): add currencies profiles and financial settings
```

---

# Phase 2.3 — Accounts and cash ledger

## Objective

Implement transaction-derived cash accounts, opening balances, and same-currency or cross-currency transfers without treating investments as expenses.

## Database objects

- `accounts`
- `transactions`
- Transfer creation RPC
- Opening-balance RPC or validated write path
- RLS policies, constraints, and indexes

## Application files

Expected future changes:

```text
supabase/migrations/<timestamp>_create_accounts_and_cash_ledger.sql
supabase/migrations/<timestamp>_add_cash_ledger_functions.sql
supabase/tests/accounts_and_transactions.sql
```

No dashboard source changes.

## Exact implementation tasks

1. Create accounts with owner, free-text name, type, currency, lifecycle dates, and archive status.
2. Add unique `(id, user_id)` for same-user composite FKs.
3. Create signed transactions with owner, account, type, amount, currency, date, description, and optional transfer group.
4. Support types such as `opening_balance`, `deposit`, `withdrawal`, `income`, `expense`, `transfer`, `fee`, `interest`, and `adjustment`.
5. Explicitly prohibit `investment_purchase` and `investment_sale` as ordinary expense/income types.
6. Enforce nonzero transaction amounts.
7. Enforce transaction currency equals account currency through a trigger or controlled function.
8. Model opening balance as one transaction.
9. Create transfers atomically as two rows sharing a group ID.
10. For cross-currency transfers, record the native amount in each account; do not force equal amounts.
11. Define transfer cancellation/correction semantics.
12. Add account balance SQL used later by the authoritative calculation contract.
13. Enable RLS and same-user ownership constraints.

## Dependencies

- Phase 2.2 complete
- Currency reference data
- Approved sign and transfer semantics

## Validation commands

```bash
npx supabase db reset --local
npx supabase test db
npx supabase db lint --local
```

## Tests

- Opening balance affects balance once.
- Positive and negative signs behave as documented.
- Same-currency transfer nets correctly across accounts.
- Cross-currency transfer preserves native amounts.
- Partial transfer insertion rolls back atomically.
- Transaction currency mismatch is rejected.
- User A cannot attach a transaction to User B’s account.
- Stock purchase cannot be recorded as a generic expense type.

## Risks

- Mutable historical transactions can change all later balances.
- Transfer edits can leave one-sided records unless writes are atomic.
- Imported bank transactions may later need external IDs and deduplication.

## Rollback strategy

Before production data exists, compensate by dropping functions and ledger tables. After data exists, disable new writes, export affected rows, and use forward migrations rather than dropping history.

## Exit criteria

- Account balances derive only from transactions.
- Transfer and opening-balance tests pass.
- Investment purchases are excluded from ordinary expense semantics.
- RLS and same-user constraints pass.

## Suggested Git commit message

```text
feat(db): add accounts and cash ledger
```

---

# Phase 2.4 — Assets and valuations

## Objective

Represent non-cash assets with append-only fair-value history.

## Database objects

- `assets`
- `asset_valuations`
- RLS policies, constraints, and indexes

## Application files

Expected future changes:

```text
supabase/migrations/<timestamp>_create_assets_and_valuations.sql
supabase/tests/assets_and_valuations.sql
```

## Exact implementation tasks

1. Create generic assets for investment, gold, real estate, business, vehicle, crypto, and custom categories.
2. Store acquisition cost separately from current fair value.
3. Permit an optional same-user account relationship where operationally useful.
4. Create append-only valuation records with value, currency, effective time, source, and notes.
5. Define valuation sources: manual, imported, market, estimated.
6. Do not add `current_value` to the asset row.
7. Define latest-effective-valuation lookup.
8. Define archive behavior without removing historical participation.
9. Enforce nonnegative valuations and matching owner relationships.
10. Enable RLS and indexes for latest-valuation queries.

## Dependencies

- Phase 2.2 complete
- Account relationship optionally depends on Phase 2.3

## Validation commands

```bash
npx supabase db reset --local
npx supabase test db
npx supabase db lint --local
```

## Tests

- Latest valuation is selected by effective time, not insertion order.
- Future valuations do not affect current value.
- Asset without a valuation is reported as incomplete later.
- Negative valuations are rejected.
- Cross-user asset valuation insertion is rejected.
- Archived assets remain available for historical dates.

## Risks

- Generic valuations cannot calculate true investment returns.
- Manual valuation frequency may create stale dashboard values.
- Deleting history can alter prior calculations.

## Rollback strategy

Use a compensating migration. Preserve valuation exports before removing any deployed object containing user data.

## Exit criteria

- Asset fair value has exactly one authoritative history.
- Current and historical valuation lookup tests pass.
- RLS and ownership constraints pass.

## Suggested Git commit message

```text
feat(db): add assets and valuation history
```

---

# Phase 2.5 — Liabilities

## Objective

Represent liabilities and append-only outstanding-balance history.

## Database objects

- `liabilities`
- `liability_balances`
- RLS policies, constraints, and indexes

## Application files

Expected future changes:

```text
supabase/migrations/<timestamp>_create_liabilities_and_balances.sql
supabase/tests/liabilities_and_balances.sql
```

## Exact implementation tasks

1. Create liabilities for loans, mortgages, credit cards, business loans, taxes, and custom debt.
2. Store optional original principal, lender, interest rate, and lifecycle dates.
3. Store rates as decimal fractions.
4. Create append-only balance records with native currency and effective time.
5. Keep outstanding balances positive; subtraction occurs only in net-worth calculation.
6. Do not add a duplicated current-balance column.
7. Define latest-effective-balance lookup.
8. Enable RLS, same-user FKs, and latest-balance indexes.

## Dependencies

- Phase 2.2 complete

## Validation commands

```bash
npx supabase db reset --local
npx supabase test db
npx supabase db lint --local
```

## Tests

- Latest effective balance is selected correctly.
- Negative balances are rejected.
- Future balances do not affect current debt.
- Cross-user child relationships are rejected.
- Historical balance remains available after archive.

## Risks

- Credit facilities can have positive asset balances; MVP semantics need documented handling.
- Accrued interest is not automatically calculated.

## Rollback strategy

Use a compensating migration and preserve exported balance history if deployed.

## Exit criteria

- Liability balances have one authoritative history.
- Positive-balance and historical rules pass.
- RLS and ownership tests pass.

## Suggested Git commit message

```text
feat(db): add liabilities and balance history
```

---

# Phase 2.6 — Goals

## Objective

Support net-worth, account-balance, and manually funded goals without duplicating progress totals.

## Database objects

- `goals`
- `goal_contributions`
- RLS policies, constraints, and indexes

## Application files

Expected future changes:

```text
supabase/migrations/<timestamp>_create_goals_and_contributions.sql
supabase/tests/goals.sql
```

## Exact implementation tasks

1. Create goals with owner, name, type, progress method, target amount/currency/date, and status.
2. Support `net_worth`, `account_balance`, and `manual_contributions`.
3. Require a same-user account for account-balance goals.
4. Create signed manual contribution records.
5. Do not store a mutable `current_amount` on goals.
6. Define progress calculation semantics and caps. Recommended: retain actual progress above 100% while UI may cap the bar.
7. Define behavior for paused, completed, and archived goals.
8. Enable RLS, same-user constraints, and progress-query indexes.

## Dependencies

- Phase 2.2 complete
- Phase 2.3 for account-balance goals
- Net-worth progress becomes operational after Phase 2.9

## Validation commands

```bash
npx supabase db reset --local
npx supabase test db
npx supabase db lint --local
```

## Tests

- Invalid progress-method relationships are rejected.
- Manual contributions sum correctly.
- Negative corrections are supported but cannot produce prohibited states if such a rule is approved.
- Cross-user linked accounts and contributions are rejected.
- Goal target and date constraints work.

## Risks

- Users may assume contributions represent reserved cash when they are only manual tracking.
- Currency conversion can make goal progress change without contributions.

## Rollback strategy

Use a compensating migration; export goal history before destructive changes.

## Exit criteria

- All three progress methods have documented semantics.
- Goal data does not duplicate calculated progress.
- RLS and constraint tests pass.

## Suggested Git commit message

```text
feat(db): add financial goals and contributions
```

---

# Phase 2.7 — Minimal portfolio foundation

## Objective

Support manual portfolios and positions without introducing a full investment ledger.

## Database objects

- `portfolios`
- `portfolio_positions`
- RLS policies, constraints, and indexes

## Application files

Expected future changes:

```text
supabase/migrations/<timestamp>_create_manual_portfolios.sql
supabase/tests/portfolios.sql
```

## Exact implementation tasks

1. Create portfolios with owner, name, reporting/native currency, optional brokerage account, description, and archive state.
2. Create positions with owner, portfolio, symbol/name, asset class, quantity, manual unit price, manual total value, value currency, valued-at timestamp, and notes.
3. Select one authoritative value rule:
   - Recommended: `manual_total_value` is authoritative when present.
   - Otherwise derive `quantity × manual_unit_price` in SQL.
4. Reject negative quantity or value unless short positions are explicitly approved. Recommended MVP: no shorts.
5. Relate a portfolio optionally to a cash/brokerage account through a same-user FK.
6. Decide the relationship to generic assets:
   - Recommended: portfolio positions contribute through the portfolio domain and are not duplicated as generic asset rows.
   - Generic `investment` assets remain for holdings not managed in a portfolio.
7. Ensure net worth cannot count the same investment in both a generic asset and a position.
8. Do not record purchases as expenses. Optional cash movements related to manual position updates use neutral investment transfer/contribution semantics, not spending categories.
9. Enable RLS and same-user constraints.

## Supported manual values

- Position name and optional symbol
- Asset class
- Quantity
- Manual unit price
- Manual total market value
- Currency
- Effective valuation time
- Notes

## Explicitly deferred investment features

- Trades and order history
- Tax lots and cost-basis methods
- Realized/unrealized gain accounting
- Dividends and distributions
- Fees tied to trades
- Corporate actions
- Security master and exchange metadata
- Automated quotes
- Market-price history
- Time-weighted and money-weighted returns
- Short positions, options, margin, and derivatives

## Dependencies

- Phase 2.2 complete
- Phase 2.3 for optional brokerage cash accounts
- Approved anti-double-counting rule

## Validation commands

```bash
npx supabase db reset --local
npx supabase test db
npx supabase db lint --local
```

## Tests

- Position derived value is correct.
- Manual total-value precedence is correct.
- Negative quantities/values are rejected.
- Cross-user portfolio, account, and position relationships are rejected.
- Archived portfolios remain available historically.
- Fixture proves an investment is counted once.
- Generic expense reports do not include portfolio purchases.

## Risks

- Manual positions can become stale.
- Supporting both total value and unit price can create ambiguity without strict precedence.
- Generic investment assets can cause double counting.

## Rollback strategy

Use a compensating migration. Preserve manual position exports and detach optional account relationships before dropping objects.

## Exit criteria

- Manual positions can contribute to net worth exactly once.
- No trade-ledger behavior has been introduced.
- Stock purchases are not classified as ordinary expenses.
- RLS and anti-double-counting tests pass.

## Suggested Git commit message

```text
feat(db): add manual portfolio foundation
```

---

# Phase 2.8 — Exchange rates and multi-currency

## Objective

Provide deterministic native-to-reporting-currency conversion with explicit missing-rate behavior.

## Database objects

- `exchange_rates`
- Currency conversion helper function
- Trusted rate-write function or backend path
- Read policies and indexes

## Application files

Expected future changes:

```text
supabase/migrations/<timestamp>_create_exchange_rates.sql
supabase/migrations/<timestamp>_add_currency_conversion_functions.sql
supabase/tests/exchange_rates.sql
```

## Exact implementation tasks

1. Create dated base/quote exchange rates using `numeric`.
2. Define semantics: `1 base × rate = quote`.
3. Store source and creation timestamp.
4. Add positive-rate and nonidentical-pair constraints.
5. Define lookup as latest approved rate on or before the effective date.
6. Treat same-currency conversion as an internal exact rate of `1`; do not require a table row.
7. For different currencies with no rate, return a structured warning.
8. Do not use an implicit fallback rate.
9. Define direct-pair versus inverse-pair behavior. Recommended: accept direct or mathematically invert an available reverse pair, recording provenance.
10. Restrict client writes. Authenticated clients receive read access only.
11. Define a trusted service-role, scheduled function, or administrator import path for writes.

## Dependencies

- Phase 2.2 currencies
- Approved rate provider and source policy

## Validation commands

```bash
npx supabase db reset --local
npx supabase test db
npx supabase db lint --local
```

## Tests

- Direct conversion is correct.
- Reverse conversion is correct within approved precision.
- Same-currency conversion is exactly one.
- Future rates are not used for past calculations.
- Missing rate returns a warning and incomplete status.
- Zero and negative rates are rejected.
- Authenticated users cannot write rates.

## Risks

- Stale or licensed rate data can invalidate reporting.
- Inverse rates introduce rounding considerations.
- Weekend and holiday lookup rules must be stable.

## Rollback strategy

Disable the trusted write path first, preserve rates used by snapshots, and apply a forward migration. Never delete rates referenced by historical calculations without preserving snapshot-item rates.

## Exit criteria

- Conversion semantics are documented and tested.
- Missing rates cannot silently produce complete calculations.
- Rate writes are trusted-only.
- Historical lookup tests pass.

## Suggested Git commit message

```text
feat(db): add multi-currency exchange rates
```

---

# Phase 2.9 — Net-worth calculation contract

## Objective

Create one database-authoritative contract for current and point-in-time net-worth calculations.

## Database objects

- Internal financial component query/functions
- Authenticated net-worth RPC
- Result types or JSON contract
- Calculation-version constant or table

## Application files

Expected future changes:

```text
supabase/migrations/<timestamp>_add_net_worth_calculation.sql
supabase/tests/net_worth_calculation.sql
docs/                               # RPC contract documentation
```

## Exact implementation tasks

1. Define an RPC that derives the user from `auth.uid()`.
2. Accept calculation timestamp and optional reporting currency only within approved rules.
3. Calculate account balances from transactions through the timestamp.
4. Select latest effective asset valuations.
5. Select latest effective liability balances.
6. Include manual portfolio positions using their authoritative manual-value rule.
7. Prevent generic-asset and portfolio double counting.
8. Convert each component into reporting currency.
9. Return:
   - status: `complete` or `incomplete`
   - calculation version
   - effective timestamp
   - reporting currency
   - account total
   - non-cash asset total
   - portfolio total
   - liability total
   - net worth
   - allocation totals
   - component rows
   - structured warnings
10. Return warnings for missing valuations, liability balances, and exchange rates.
11. Define incomplete total behavior. Recommended: return partial totals labeled incomplete, never present them as authoritative complete totals.
12. Keep all authoritative arithmetic in SQL using `numeric`.
13. Secure the RPC, set an explicit `search_path`, and avoid trusting user IDs from the client.

## Dependencies

- Phases 2.3–2.8 complete
- Approved warning and incomplete-total semantics

## Validation commands

```bash
npx supabase db reset --local
npx supabase test db
npx supabase db lint --local
```

## Tests

- Single-currency net worth fixture.
- Multi-currency fixture.
- Transfers do not inflate total wealth.
- Liabilities are subtracted exactly once.
- Portfolio positions and generic assets are not double counted.
- Missing valuation returns incomplete.
- Missing liability balance returns incomplete.
- Missing FX rate returns incomplete with the affected entity and currency pair.
- User A cannot calculate User B’s net worth.
- Point-in-time calculations ignore future records.
- Calculation result is deterministic for the same inputs.

## Risks

- Complex SQL may become difficult to maintain without component-level tests.
- Partial totals can be mistaken for complete totals.
- Calculation changes can alter history unless versioned.

## Rollback strategy

Deploy calculation changes as versioned forward migrations. Preserve the previous RPC version until consumers migrate, then revoke it in a later migration.

## Exit criteria

- One RPC is the authoritative net-worth contract.
- All complete/incomplete and ownership tests pass.
- Calculation version is returned.
- No frontend financial aggregation is required.

## Suggested Git commit message

```text
feat(db): add authoritative net worth calculation
```

---

# Phase 2.10 — Historical snapshots

## Objective

Persist auditable historical net-worth calculations without losing incomplete-data warnings.

## Database objects

- `net_worth_snapshots`
- `net_worth_snapshot_items`
- Snapshot-warning storage, either structured `jsonb` or normalized table
- Snapshot creation RPC
- RLS policies and indexes

## Application files

Expected future changes:

```text
supabase/migrations/<timestamp>_create_net_worth_snapshots.sql
supabase/migrations/<timestamp>_add_snapshot_creation_function.sql
supabase/tests/net_worth_snapshots.sql
```

## Exact implementation tasks

1. Create one snapshot per user, date, and reporting currency.
2. Store totals, status, calculation version, calculated time, and warnings.
3. Store each account, asset, portfolio position, and liability component with native amount, converted amount, currencies, rate, and source effective time.
4. Reuse the Phase 2.9 calculation logic; do not reimplement formulas.
5. Mark snapshots `complete` only when all required values and rates exist.
6. Store incomplete snapshots with warnings if approved in Phase 2.0.
7. Upsert only the current day under the approved timezone.
8. Treat closed historical days as immutable by default.
9. Preserve snapshot base currency and exchange rates.
10. Create snapshots through an authenticated RPC, not direct client inserts.
11. Define explicit historical regeneration behavior and audit it later through the deferred event log.
12. Add daily scheduling only after manual RPC behavior is verified.

## Dependencies

- Phase 2.9 complete
- Snapshot status and preservation decisions approved

## Validation commands

```bash
npx supabase db reset --local
npx supabase test db
npx supabase db lint --local
```

## Tests

- Complete snapshot stores totals and every component.
- Missing FX creates incomplete snapshot and warning.
- Missing valuation creates incomplete snapshot.
- Current-day recreation updates rather than duplicates.
- Historical snapshot remains unchanged after current data changes.
- Base-currency change does not silently rewrite history.
- Snapshot items reconcile exactly to snapshot totals.
- User isolation applies to snapshots and items.
- Direct client snapshot writes are rejected.

## Risks

- Snapshot volume grows with users and components.
- Regeneration can rewrite financial history.
- JSON warnings are flexible but less queryable than normalized warnings.

## Rollback strategy

Disable scheduling and RPC execution first. Preserve snapshot exports. Use forward schema changes; avoid dropping historical evidence.

## Exit criteria

- Snapshot and item totals reconcile.
- Complete/incomplete statuses are reliable.
- Historical preservation tests pass.
- Direct writes are blocked and RLS passes.

## Suggested Git commit message

```text
feat(db): add auditable net worth snapshots
```

---

# Phase 2.11 — Generated TypeScript types

## Objective

Generate schema-derived TypeScript types and type the Supabase client without changing UI behavior.

## Database objects

None.

## Application files

Expected future changes:

```text
src/lib/supabase/database.types.ts
src/lib/supabase/client.ts
src/lib/supabase.ts                 # compatibility re-export if needed
package.json                         # optional type-generation/check scripts
```

## Exact implementation tasks

1. Generate types from the reset local database.
2. Mark generated types as machine-owned.
3. Type `createClient<Database>()`.
4. Preserve the existing Supabase Auth behavior and import compatibility.
5. Add a repeatable generation command.
6. Define how CI detects stale generated types.
7. Keep generated row types separate from domain types.

## Dependencies

- Phases 2.2–2.10 complete and stable

## Validation commands

```bash
npx supabase gen types --lang typescript --local
npm run typecheck
npm run lint
npm run build
```

## Tests

- Type generation is deterministic.
- Typed queries compile.
- Existing authentication compiles and behaves unchanged.
- Generated file matches the local migration chain.

## Risks

- Manual edits to generated files will be overwritten.
- Numeric database fields may be represented as strings and require domain mapping.

## Rollback strategy

Restore the existing untyped client and remove generated-type imports. Database state is unaffected.

## Exit criteria

- Supabase client is database-typed.
- Generated and domain types have separate ownership.
- Lint, type-check, and build pass.

## Suggested Git commit message

```text
chore: generate Supabase database types
```

---

# Phase 2.12 — Repository and service layer

## Objective

Provide typed application boundaries over Supabase without connecting the dashboard yet.

## Database objects

No new tables. RPC grants may be adjusted through migration if tests reveal missing permissions.

## Application files

Expected future changes:

```text
src/domain/finance/money.ts
src/domain/finance/currency.ts
src/domain/finance/errors.ts
src/features/accounts/accounts.repository.ts
src/features/accounts/accounts.service.ts
src/features/assets/assets.repository.ts
src/features/assets/assets.service.ts
src/features/liabilities/liabilities.repository.ts
src/features/liabilities/liabilities.service.ts
src/features/goals/goals.repository.ts
src/features/goals/goals.service.ts
src/features/portfolios/portfolios.repository.ts
src/features/portfolios/portfolios.service.ts
src/features/dashboard/dashboard.repository.ts
src/features/dashboard/dashboard.types.ts
```

## Exact implementation tasks

1. Define `Money`, `CurrencyCode`, warning, and calculation-status domain types.
2. Keep authoritative arithmetic in database RPCs.
3. Map generated database rows into domain objects.
4. Create repositories for query and persistence only.
5. Create services for transfers, opening balances, valuations, balance updates, goal contributions, and manual positions.
6. Ensure services never accept or trust arbitrary ownership IDs when session ownership is available.
7. Normalize Supabase errors into domain errors.
8. Handle incomplete calculation results explicitly.
9. Add unit tests with mocked repository boundaries and integration tests against local Supabase.

## Dependencies

- Phase 2.11 complete
- Stable RPC contracts

## Validation commands

```bash
npm run lint
npm run typecheck
npm run build
npx supabase test db
```

## Tests

- Generated-to-domain mapping.
- Numeric parsing without silent precision loss.
- Error mapping.
- Transfer service atomic behavior.
- Incomplete calculation warning propagation.
- Repository queries remain user-scoped in addition to RLS.

## Risks

- Reimplementing arithmetic in services would create a second source of truth.
- Converting arbitrary-precision numbers to JavaScript numbers can lose precision.
- Over-generic repositories can obscure domain rules.

## Rollback strategy

Repositories and services are additive and not yet consumed by the UI. Remove their imports/files while retaining the tested database.

## Exit criteria

- Financial access occurs through typed repositories/services.
- No authoritative financial formulas exist in React or service code.
- Incomplete results cannot be mistaken for complete results.
- Quality checks pass.

## Suggested Git commit message

```text
feat: add typed financial repositories and services
```

---

# Phase 2.13 — Dashboard live-data adapter

## Objective

Adapt the authoritative dashboard result to the existing UI contract without visual redesign or immediate mock removal.

## Database objects

- Existing net-worth RPC
- Optional dashboard-specific read RPC if needed for one round trip

## Application files

Expected future changes:

```text
src/features/dashboard/dashboard.repository.ts
src/features/dashboard/dashboard.service.ts
src/features/dashboard/dashboard.adapter.ts
src/features/dashboard/dashboard.types.ts
src/pages/DashboardPage.tsx
src/components/dashboard/PerformanceChart.tsx
```

Changes to current components should be limited to data injection, loading/error/incomplete state wiring, and currency formatting. No redesign.

## Exact implementation tasks

1. Define a live dashboard view model compatible with current summary cards, allocation rows, activity rows, goal card, and chart points.
2. Map database totals into that view model.
3. Use historical snapshots for the chart.
4. Use reporting currency for all dashboard formatting.
5. Preserve existing mock constants in a dedicated mock provider or fixture.
6. Add explicit switching:
   - development flag, or
   - internal data-source adapter
7. Default to mock mode until live verification is approved.
8. Add loading, error, empty, and incomplete data contracts without redesigning visuals.
9. Do not display incomplete totals as confirmed values.
10. Compare live results against controlled fixture calculations.
11. Switch production to live only after all verification rules pass.

## Dependencies

- Phase 2.12 complete
- Snapshot history available
- Current dashboard behavior captured by tests

## Validation commands

```bash
npm run lint
npm run typecheck
npm run build
npx supabase test db
```

## Tests

- Mock mode renders current values and interactions unchanged.
- Live adapter maps known fixtures exactly.
- Currency formatting follows settings.
- Chart period behavior remains unchanged.
- Incomplete result displays an explicit non-authoritative state.
- Missing data never becomes a misleading zero.
- No duplicate requests or client-side financial recomputation.

## Risks

- Adapter changes can unintentionally alter the current UI.
- Mock and live contracts can drift.
- “Portfolio performance” wording may misrepresent net-worth history.

## Rollback strategy

Switch the explicit data source back to mock mode. Keep live repositories in place for diagnosis without affecting users.

## Exit criteria

- Current mock UI remains visually and behaviorally stable.
- Live view model matches authoritative fixtures.
- Mock/live switching is explicit and reversible.
- Production switching has separate approval.

## Suggested Git commit message

```text
feat: add verified dashboard live data adapter
```

---

# Phase 2.14 — Rollout and validation

## Objective

Validate the entire migration chain, security model, application integration, backups, and rollback process before production use.

## Database objects

All Phase 2 objects. No new product tables should be introduced during rollout.

## Application files

Expected future changes may include:

```text
docs/PHASE_2_RUNBOOK.md
docs/PHASE_2_VERIFICATION.md
CI workflow files
environment example documentation
```

## Exact implementation tasks

1. Reset local database from zero and replay every migration.
2. Regenerate TypeScript types from the reset schema.
3. Run database lint and SQL tests.
4. Run two-user and anonymous RLS tests for every user-owned table and RPC.
5. Run frontend lint, type-check, tests, and production build.
6. Create representative multi-currency fixtures.
7. Reconcile every fixture manually against expected net worth.
8. Verify complete and incomplete snapshots.
9. Capture current remote backup or confirm point-in-time recovery.
10. Preview staging migration changes.
11. Deploy to staging.
12. Run staging smoke, RLS, and reconciliation tests.
13. Practice rollback or forward-fix procedure on staging.
14. Keep production dashboard in mock mode during schema rollout.
15. Enable live mode only after database and adapter approval.
16. Monitor errors, missing-rate warnings, snapshot status, and query performance.

## Dependencies

- Phases 2.1–2.13 complete
- Staging environment
- Approved backup and rollout window

## Validation commands

```bash
npx supabase db reset --local
npx supabase migration list --local
npx supabase db lint --local
npx supabase test db
npx supabase gen types --lang typescript --local
npm run lint
npm run typecheck
npm run build
npx supabase db push --dry-run
```

Linked commands must identify the intended environment explicitly and require human verification.

## Tests

- Full recommended matrix below
- Fresh migration replay
- RLS penetration checks
- Snapshot reconciliation
- Staging smoke tests
- Mock fallback test
- Backup restore or documented recovery verification

## Risks

- Remote drift can invalidate migration assumptions.
- A policy omission can expose financial data.
- Enabling live mode before sufficient snapshots exist can degrade the dashboard.
- Rollback of destructive schema changes is difficult once user data exists.

## Rollback strategy

1. Keep mock dashboard fallback deployable.
2. Disable live-data feature selection.
3. Stop scheduled snapshot/rate jobs.
4. Revoke affected RPC execution if security is in doubt.
5. Prefer forward-fix migrations for deployed schemas.
6. Restore from verified backup only for severe data corruption.
7. Never run a linked reset against production.

## Exit criteria

- Clean local reset replays the complete migration chain.
- All database and application checks pass.
- Two-user RLS tests pass for every object.
- Staging reconciliation matches expected values.
- Backup and rollback procedures are verified.
- Production dashboard live mode receives explicit approval.

## Suggested Git commit message

```text
chore: validate Phase 2 financial data rollout
```

---

# Final migration order

1. Currency reference and profile layer
2. Financial settings
3. Accounts and cash ledger
4. Cash-ledger functions
5. Assets and valuations
6. Liabilities and balances
7. Goals and contributions
8. Manual portfolios and positions
9. Exchange rates
10. Currency conversion functions
11. Net-worth calculation contract
12. Snapshot tables
13. Snapshot creation function
14. Final grants, RLS hardening, and performance indexes

RLS should normally be created in the same migration as each table so a user-owned table is never deployed exposed. A final hardening migration is still recommended for verification and RPC grants.

# Proposed migration file names

Timestamps will be generated when implementation begins:

```text
supabase/migrations/<timestamp>_create_reference_and_profile_layer.sql
supabase/migrations/<timestamp>_create_financial_settings.sql
supabase/migrations/<timestamp>_create_accounts_and_cash_ledger.sql
supabase/migrations/<timestamp>_add_cash_ledger_functions.sql
supabase/migrations/<timestamp>_create_assets_and_valuations.sql
supabase/migrations/<timestamp>_create_liabilities_and_balances.sql
supabase/migrations/<timestamp>_create_goals_and_contributions.sql
supabase/migrations/<timestamp>_create_manual_portfolios.sql
supabase/migrations/<timestamp>_create_exchange_rates.sql
supabase/migrations/<timestamp>_add_currency_conversion_functions.sql
supabase/migrations/<timestamp>_add_net_worth_calculation.sql
supabase/migrations/<timestamp>_create_net_worth_snapshots.sql
supabase/migrations/<timestamp>_add_snapshot_creation_function.sql
supabase/migrations/<timestamp>_harden_financial_rls_and_indexes.sql
```

# Recommended test matrix

## Authentication and ownership

- Anonymous access denied
- User A CRUD on own rows
- User A cannot select User B rows
- User A cannot insert a child for User B parent
- User A cannot change ownership during update
- Cascade behavior after user deletion
- RPC derives user from `auth.uid()`

## Accounts and transactions

- Opening balances
- Positive/negative signs
- Same-currency transfers
- Cross-currency transfers
- Atomic rollback
- Currency mismatch rejection
- Historical cutoff
- Stock purchase excluded from expense semantics

## Assets, liabilities, and portfolios

- Latest effective records
- Future record exclusion
- Archive history
- Missing valuation/balance
- Manual position precedence
- No shorts in MVP
- No generic-asset/portfolio double counting

## Goals

- Net-worth progress
- Account progress
- Manual contribution progress
- Cross-currency contributions
- Overfunded goals
- Paused/completed/archive behavior

## Currency conversion

- Same currency
- Direct pair
- Reverse pair
- Historical date
- Weekend/holiday fallback
- Missing pair
- Rounding and high precision
- Unauthorized rate write

## Net worth and snapshots

- Single currency
- Multiple currencies
- Assets plus cash minus liabilities
- Transfer neutrality
- Portfolio inclusion
- Point-in-time correctness
- Complete result
- Incomplete result and warnings
- Snapshot reconciliation
- Current-day upsert
- Historical immutability
- Calculation-version behavior

## Application

- Generated type freshness
- Repository mappings
- Numeric handling
- Error mapping
- Mock dashboard regression
- Live fixture parity
- Mock fallback
- Lint, type-check, tests, and production build

# Decisions still requiring user approval

1. Initial supported currencies and default currency.
2. Exchange-rate provider, refresh schedule, and licensing.
3. Exact reporting-currency authority between profile and financial settings.
4. Default financial assumptions and acceptable validation ranges.
5. Profile/settings creation trigger versus first-login RPC.
6. Manual portfolio value precedence.
7. Whether generic investment assets may coexist with portfolio positions and how the UI prevents duplication.
8. Whether cash movements related to positions are optional or required.
9. Goal progress and overfunding behavior.
10. Snapshot cutoff timezone and schedule.
11. Whether incomplete snapshots are persisted.
12. Warning storage as `jsonb` versus normalized rows.
13. Historical regeneration policy after corrections or currency changes.
14. Historical record edit/delete versus correction-entry workflow.
15. When production switches from mock to live data.

# Explicit deferred features

- Full investment transaction ledger
- Orders and trades
- Tax lots and cost basis
- Realized and unrealized gains
- Dividends, distributions, and corporate actions
- Automated quotes and market-price history
- Investment performance calculations
- Bank and brokerage synchronization
- Import batches and deduplication
- Budgets and spending categories
- Recurring transactions
- Advanced real-estate, business, gold, vehicle, and crypto modules
- Household and shared financial profiles
- Advisor access
- AI insights and recommendations
- Financial health score
- Notifications
- Audit/event logging
- Data import/export workflows
- Automated snapshot repair and historical backfills

Audit/event logging is explicitly part of the deferred roadmap. When introduced, it should record material financial mutations, snapshot regeneration, imports, and administrative actions without becoming a second financial ledger.

# Definition of Phase 2 completion

Phase 2 is complete only when:

- All approved MVP migrations replay successfully from an empty local database.
- Currency, profile, financial settings, accounts, transactions, assets, valuations, liabilities, balances, goals, contributions, portfolios, positions, exchange rates, calculations, and snapshots are implemented.
- Every user-owned object has tested RLS and same-user ownership constraints.
- Cash, asset, liability, portfolio, and goal values each have one authoritative source.
- Stock purchases are not treated as ordinary expenses.
- Multi-currency calculations use dated rates and never silently default missing rates to one.
- Net-worth RPC results explicitly distinguish complete and incomplete calculations.
- Historical snapshots retain status, warnings, calculation version, component values, and applied rates.
- Supabase TypeScript types are generated and the client is typed.
- Repositories and services expose domain-safe APIs without duplicating database calculations.
- The live dashboard adapter matches controlled fixtures.
- The current dashboard has not been visually redesigned.
- Mock mode remains available until live mode receives explicit approval.
- Lint, type-check, database tests, application tests, and production build pass.
- Staging rollout, RLS isolation, backup, and rollback procedures are verified.
