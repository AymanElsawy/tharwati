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
