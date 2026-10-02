# Database baseline and bootstrap

## Purpose

Historical `supabase db reset --local` is not the supported fresh bootstrap route: an August migration references ledger/assets tables before their creation, so replay from zero fails. We do not rewrite applied migrations to fix that ordering. They remain immutable deployment history.

Fresh local and CI databases use the versioned baseline in `supabase/baselines/` and then apply only forward migrations newer than its checkpoint.

The current checkpoint is `20260922120000`.

## Safety boundary

The baseline is outside `supabase/migrations`, so normal linked `db push` operations never treat it as a pending migration.

The bootstrap and verification scripts:

- require an explicit PostgreSQL URL and `-ConfirmDisposable`;
- accept only `localhost` or `127.0.0.1` targets;
- bootstrap rejects port `54322`, the default project ID, the repository workdir, and a workdir linked via `supabase/.temp/project-ref`;
- bootstrap requires the URL port to map directly to the running `supabase_db_<project_id>` Docker container and executes SQL inside that local container;
- require no public objects, Auth users/identities, Storage objects/buckets, or migration history before bootstrap;
- never use `--linked`, a project reference, or remote credentials;
- contain no command that resets the default local database;
- never invoke migration repair, migration up, db push, or record historical versions during fresh bootstrap.

Do not weaken these checks to target a linked, hosted, shared, or production database.

## Baseline contents

`20260922120000_schema.sql` is a schema-only dump of the linked remote `public` schema generated with Supabase CLI 2.117.0. It includes tables, functions, constraints, indexes, triggers, policies, grants, RLS state, and default privileges. The Tharwati-owned `on_auth_user_created` trigger on Supabase-owned `auth.users` is included explicitly; the managed Auth schema itself is excluded.

`20260922120000_reference_data.sql` contains only application catalogue rows:

- account types;
- asset types;
- transaction types;
- supported currencies;
- system record categories and subcategories.

It excludes Auth users, profiles, accounts, transactions, holdings, goals, prices, exchange rates, snapshots, custom categories, and all other user or operational data.

`20260922120000_manifest.json` records provenance, represented migration versions, included/excluded schemas, expected object counts, artifact hashes, and a deterministic database-catalog fingerprint.

## Creating a disposable environment

Start a separate Supabase project with a different project ID and ports. Do not point these scripts at the repository's default local stack. Docker Desktop must be running. This creates a managed Supabase database with an empty application schema, not a bare PostgreSQL server.

From the repository root:

```powershell
# Disposable workdir contains only a config, no migrations or seeds.
$fresh = Join-Path $PWD 'fresh-bootstrap.local'
New-Item -ItemType Directory -Path "$fresh/supabase" -Force | Out-Null
$config = Get-Content ./supabase/config.toml -Raw
$config = $config.Replace('project_id = "Tharwati"', 'project_id = "TharwatiFreshBootstrap"')
$config = $config -replace '543(\d{2})', '563$1'
$config = $config -replace '(?ms)^\[functions\.[^\]]+\]\r?\n.*?(?=^\[|\z)', ''
Set-Content "$fresh/supabase/config.toml" $config -Encoding UTF8
npx.cmd --yes supabase@2.117.0 start --workdir $fresh `
  -x studio,postgres-meta,edge-runtime,logflare,vector,realtime,imgproxy,mailpit
if ($LASTEXITCODE -ne 0) { throw 'Disposable stack startup failed' }

./scripts/database/create-fresh-environment.ps1 `
  -DbUrl 'postgresql://postgres:postgres@127.0.0.1:56322/postgres' `
  -SupabaseWorkdir $fresh `
  -ConfirmDisposable

# After validation/use, remove this stack and its volumes (no retained database).
npx.cmd --yes supabase@2.117.0 stop --no-backup --workdir $fresh
```

Use a new project ID/workdir for a second fresh run. Never reuse a populated stack. The script verifies both SHA-256 hashes before loading, restores schema and reference data, verifies the exact baseline fingerprint, applies all real `supabase/migrations/*.sql` files with timestamps strictly greater than `20260922120000` in filename/timestamp order, and verifies the resulting schema. `.test.ts` files are excluded. Duplicate timestamps and malformed SQL migration names are rejected. Each SQL command uses `psql -X --set=ON_ERROR_STOP=1`; failure stops immediately and the partially loaded disposable stack must be discarded.

The current ordered forward sequence is:

1. `20260922130000_order_account_record_history_deterministically.sql`
2. `20260923120000_add_idempotent_account_record_v2.sql`
3. `20260924120000_add_idempotent_brokerage_mutations_v2.sql`
4. `20260924131500_add_idempotent_account_creates_v2.sql`
5. `20260924163000_harden_financial_history_immutability.sql`
6. `20260927160000_add_account_display_order.sql`

Discovery is automatic: future database changes must remain new forward SQL migrations after the cutoff. Never edit already-applied migrations. Baseline files and historical migration history are not changed or marked applied. This direct SQL database is intentionally unsuitable for CLI migration replay/up/push; use the same fresh bootstrap for reconstruction.

After the emptiness check, bootstrap recreates only the empty `public` schema to remove Supabase's initial permissive default grants. Otherwise those grants survive the additive schema dump and allow anonymous table access. Baseline verification requires the exact checkpoint fingerprint and denied anonymous access; the baseline artifacts themselves remain unchanged. Native SQL input is explicitly UTF-8, preserving Arabic reference data in Windows PowerShell.

Output explicitly reports baseline loaded, reference data loaded, each migration applied, schema ready, and test results. The six focused SQL integration tests cover safe goal deletion, account-record idempotency, brokerage idempotency, account-create idempotency, financial-history immutability, and account display ordering. Their synthetic fixtures roll back; verification is repeated after tests to ensure no private data remains.

If `psql` is unavailable locally, the scripts use the official `postgres:17-alpine` image as a client. Docker must then be running and the database port must be reachable from `host.docker.internal`.

## Verification coverage

Verification checks:

- baseline artifact SHA-256 hashes and credential patterns;
- represented migration history in the verifier's default `History` mode; fresh bootstrap uses `BootstrapCheckpoint`/`BootstrapCurrent` without recording history;
- expected tables, RPCs, views, indexes, constraints, triggers, and policies;
- RLS on every public table;
- fixed empty `search_path` on every public `SECURITY DEFINER` function;
- the Auth profile trigger;
- anonymous table grants and Goal delete grants;
- exact static catalogue counts;
- absence of custom catalogue and user/private rows;
- a deterministic catalog fingerprint covering relations, columns, constraints, functions, policies, triggers, ACLs, RLS, and routine configuration.

For reproducibility, compare the reported post-checkpoint fingerprints from two independent fresh runs. A stronger comparison can export `pg_dump --schema-only --schema=public --schema=private` and the named Auth integration trigger from each local container; strip only dump-generated `\restrict`/`\unrestrict` tokens before comparing. Do not export data. SQL integration tests are focused coverage; Python concurrency and application tests are not part of this bootstrap.

## Fresh bootstrap validation — 2026-10-01

Two independent empty Supabase 2.117.0 / PostgreSQL 17 stacks were validated sequentially: `TharwatiFreshValidationA` on port `56322`, then `TharwatiFreshValidationB` on port `57322`. Each loaded the unchanged, hash-verified baseline and reference data, applied all six forward migrations above, and passed all six focused SQL tests. The first stack and volumes were destroyed before starting the second; the second stack and volumes were also destroyed. Remote-host, default-port, and nonempty-database refusal checks passed.

Both runs matched checkpoint fingerprint `bbef2bac7375127577285ca6e0a96bb3` before forward migrations and current public catalog fingerprint `7ce2f9c8843980ee124d3e8f3eeecf9d` before and after tests. Both produced 26 public tables, 85 public indexes, 109 public functions, one private table/index, and four private functions. Tests left no user/private rows or Auth users, and migration history remained unrecorded.

Schema-only dumps of **both `public` and `private`**, plus the named Auth trigger definition, were byte-identical after removing only generated `\restrict`/`\unrestrict` lines and normalizing UTF-8/LF encoding. Shared SHA-256: `e2b002a758667158eee4e768b987f37cc755a66c1889e8be1fcfe01c35e328ab`. This comparison includes constraints, indexes, grants/default privileges, policies, and function/trigger definitions. Fresh Environment Bootstrap is **CLOSED** for this scope; historical replay, remote deployment, production recovery, and concurrency/application testing remain outside it.

## Supported Mobile local development

`scripts/database/start-local-development.ps1` provisions the persistent smoke
environment in ignored `mobile-development.local/`, project
`TharwatiMobileDevelopment`. The old `Tharwati` stack remains untouched. Its latest
observed migration is `20260817020000`; its account schema lacks current columns,
Goals/progress and Dashboard snapshots are absent, and its Edge Runtime is stopped.
Do not run current application smoke tests against that stale stack.

| Service | Host endpoint |
| --- | --- |
| Auth, PostgREST/Data API, Edge Functions | `http://127.0.0.1:58321` |
| Android emulator API | `http://10.0.2.2:58321` |
| PostgreSQL 17 | `127.0.0.1:58322`, database `postgres` |
| Local email inbox | `http://127.0.0.1:58324` |
| Reserved shadow DB / Studio / analytics | `58320` / `58323` / `58327` (not running) |
| Edge inspector | `8085` (only if explicitly enabled) |

Storage retains the managed schemas; current Mobile does not upload files.
Studio, metadata, analytics, realtime, vector, and image proxy are excluded.
Docker Desktop must run. This development-only stack uses local credentials;
do not expose it on an untrusted network.

From repository root:

```powershell
./scripts/database/start-local-development.ps1
# Separate terminal: keep running; also refreshes runtime source.
./scripts/database/start-local-development.ps1 -ServeFunctions
```

The launcher copies the dedicated tracked config with migrations/seeds disabled
and only runtime TypeScript source into the ignored workdir, never repository
`.env` files. It rejects linked workdirs, migrations/seed files, and config drift.
First start invokes unchanged `create-fresh-environment.ps1`: cutoff
`20260922120000`, verified baseline/reference-data hashes and fingerprint, all
current forward SQL migrations, and six rollback-only integration tests.
A completion marker records bootstrap-input hashes. Later starts preserve local
users/data and refuse changed inputs rather than silently resetting or replaying
history. If inputs change, review and reconstruct only the dedicated environment
through the approved fresh bootstrap. Never run historical `db reset` or delete
the old stack as part of this workflow.

Database/services use pinned CLI `2.117.0`. On this host its Edge Runtime
`v1.74.3` exits 139 before logging, including an isolated offline binary probe.
Function serving is independently pinned to CLI `2.111.0`, whose cached
`v1.74.2` image starts successfully. This is a local tooling compatibility pin,
not a function/application behavior change. Exact underlying serve command:

```powershell
npx.cmd --yes supabase@2.111.0 functions serve `
  --workdir ./mobile-development.local `
  --env-file ./mobile-development.local/functions.env `
  --no-verify-jwt
```

Prefer the launcher to refresh source first. Its explicit empty env file prevents
auto-loading provider `.env` files. The CLI supplies local `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEYS`, and `SUPABASE_SECRET_KEYS` maps. The legacy gateway
verifier is bypassed locally; every current handler validates callers through
local Auth `getUser()`. Probes require invalid-token 401 responses for all seven
functions. Do not transfer this flag to hosted configuration. See the
[Supabase CLI serve reference](https://supabase.com/docs/reference/cli/supabase-functions-serve).

Ignored `mobile-development.local/status.json` contains `PUBLISHABLE_KEY`, the
public `sb_publishable_*` key Mobile needs. Never use its `SECRET_KEY`, legacy
`ANON_KEY`, or `SERVICE_ROLE_KEY` in Mobile. The status file also contains local
privileged credentials: never commit it or print it in shared logs. There is no
hosted/default fallback. See [the exact emulator command](mobile.md#android-emulator-local-development-powershell).

### Edge dependencies and provider limits

| Function | Local capability / external dependency |
| --- | --- |
| `dashboard-valuation` | Auth, accounts, balances/valuations/ownership/metal-purchase RPCs, holdings, and snapshots are local. SAR cash needs no provider. Brokerage uses `market-prices`; FX uses `fx-rates`; gold/silver spot values need public `https://api.gold-api.com/price/XAU` or `/XAG`, without a secret. Missing sources retain null values and incomplete/unavailable diagnostics. |
| `fx-rates` | Same-currency identity is local (rate 1). Cross-currency rates need `https://api.frankfurter.dev/v2`, with no secret. Failure uses existing genuine stale/manual rates where applicable; otherwise HTTP 422 `available=false`. No fabricated rates. |
| `investment-fx` | Retained legacy function, not used by current Mobile. Auth/route respond locally, but its `add_investment` / `edit_investment` RPCs are absent from the approved current schema. Its mutation path remains unsupported; do not add replacement business logic for local smoke tests. Its cross-currency resolution also requires Frankfurter or genuine historical cache/manual rates. Current Mobile brokerage mutations use the existing newer brokerage RPCs. |
| `asset-search` | Local Auth; live search needs a separately provisioned development `TWELVE_DATA_API_KEY` for Twelve Data `symbol_search`. Intentionally absent: HTTP 200 `available=false, results=[]`. |
| `market-prices` | Local Auth/assets/identifiers/cache. Live quotes need `TWELVE_DATA_API_KEY` for Twelve Data `price`/`quote`. Absent key retains genuine stale/manual prices if available; otherwise `available=false, price=null`. No quotes are seeded. |
| `delete-account` | Fully local Auth, password reauthentication, admin deletion, and database cascade. |
| `export-my-data` | Fully local Auth/export RPC; existing export cooldown applies. Not exposed by current Mobile UI. |

Twelve Data endpoints are under `https://api.twelvedata.com`. Goals and account
record/lifecycle flows use local PostgREST/RPCs, not a separate Goals function.
Recovery uses local Auth and the captured inbox; `tharwati://auth-callback` is
allowlisted. Real email delivery is not configured. Provider secrets remain
absent: do not copy production secrets, fabricate market/FX data, or modify
product behavior. These smoke probes do not call providers or hosted Supabase.
Optional future provider testing needs separate development credentials/network.

### Application probes and Android smoke

```powershell
python ./scripts/database/probe-local-development.py
```

The probe pins `127.0.0.1:58321` and the dedicated container, rejects a different
status URL, and disables HTTP proxies. It checks runtime Edge table/RPC
dependencies, creates a confirmed synthetic user, authenticates, completes
onboarding, and creates local SAR cash/Goal fixtures through current RPCs.
Credentials/IDs remain in ignored `smoke-user.json`/`smoke-fixtures.json`.
Repeat runs reuse fixtures; preserve them if rerunning the same assertions.
It exercises Mobile's actual Accounts/Dashboard/Goals selectors, balance and
valuation RPCs, snapshot persistence/cache, all seven Edge routes and invalid
Auth rejection, identity FX, unavailable search/unpriced security, recovery,
and password-reauthenticated deletion of a separate disposable synthetic user.
Its ignored `readiness.json` contains results without secrets.

Manual Android smoke: launch with the documented Mobile command; sign in with
the local smoke identity; check SAR cash balance and Dashboard value (1000);
open Accounts/record history and the Goal (target 5000, saved 100). Create
separate test accounts/Goals to exercise mutations. Brokerage search must show
unavailability without the provider key; unpriced assets stay unavailable.
Test sign-out/sign-in. Open recovery mail at `http://127.0.0.1:58324`, deliver
its recovery URL to the emulator, and verify the app recovery screen. Test
deletion with a separate local identity, preserving the reusable smoke user.

Stop only this environment with pinned CLI `supabase stop --workdir
./mobile-development.local`; the normal stop retains data for restart. Do not
use `--no-backup`, remove volumes, or delete the completion marker casually.
A marker with missing database state is not proof of readiness: rerun probes.
This environment is for local development, not deployment/migration tracking.

Validation on 2026-10-01: approved baseline checkpoint fingerprint
`bbef2bac7375127577285ca6e0a96bb3`, current fingerprint
`7ce2f9c8843980ee124d3e8f3eeecf9d`, six forward migrations, and all six bootstrap
SQL tests passed. Additional `account_balance_projection.sql`,
`exchange_rates_backend.sql`, and `export_my_data_v1.sql` passed. Two additional
older SQL tests stop during fixture setup: `market_price_temporal_integrity.sql`
writes generated Auth `confirmed_at`; `auth_user_financial_data_deletion.sql`
updates immutable disposal history. Those files/migrations are unchanged.
The actual local API probes passed, including deletion with local financial/Goal
data, honest unavailable prices, and Dashboard snapshot persistence/cache.
Repeat start preserved the same smoke user/account/Goal and passed the probes
again. The function server is currently left running in a hidden background
process; its PID and logs are under ignored `mobile-development.local/edge-server.*`.
Do not start a second function server while it is active. For a future foreground
session, stop only this dedicated stack before following the launcher commands.
Local backend application readiness is **READY**, with external providers and
unused legacy `investment-fx` limited as above. Android UI smoke is manual;
these backend probes do not claim that the emulator UI has been exercised.

## Updating the baseline

Create a new checkpoint rather than overwriting an existing baseline. Generate it from a reviewed schema-only source, add only explicitly filtered static data, test it in a disposable Supabase environment, and record new hashes and fingerprint in its manifest.

Never dump an entire mixed catalogue table when it can contain user-owned rows. Never place a baseline in `supabase/migrations`.

## Recovery boundaries

This Phase 1 baseline supports fresh local and CI schema creation. It does not restore production user data, Auth identities, Storage objects, secrets, or operational market/FX data.

Production disaster recovery must use managed backups/PITR and separately tested logical-data restoration. Replacing the current default local database is a later, explicit recovery phase after this baseline has passed disposable validation.

## Default local recovery

`scripts/database/recover-local.ps1` is the Phase 2 recovery entry point. It targets only `localhost` or `127.0.0.1`, port `54322`, database `postgres`, and requires the literal confirmation `RECOVER_DEFAULT_LOCAL_THARWATI`. It refuses every remote host and every other database target.

The caller must first provide a verified backup directory containing `postgres.dump`, `globals.sql`, `supabase_db_Tharwati.tgz`, and `restore-metadata.json`. Recovery replaces the local application schema, clears local Auth and Storage user data, restores the validated baseline and reference catalogue, records represented migrations, applies only newer migrations, runs lint, and executes the baseline security verifier.

Example:

```powershell
./scripts/database/recover-local.ps1 `
  -DbUrl $env:THARWATI_DEFAULT_LOCAL_DB_URL `
  -BackupDirectory 'E:\Private\Backups\tharwati\local-recovery-YYYYMMDD-HHMMSS' `
  -Confirmation RECOVER_DEFAULT_LOCAL_THARWATI
```

This is intentionally not a production or linked-project recovery command.
