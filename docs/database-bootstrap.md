# Database baseline and bootstrap

## Purpose

The active migration history contains an applied migration whose checked-in SQL was changed after deployment. A clean replay therefore cannot reconstruct the current database reliably. Applied migrations remain immutable; they continue to represent the linked project's deployment history.

Fresh local and CI databases use the versioned baseline in `supabase/baselines/` and then apply only forward migrations newer than its checkpoint.

The current checkpoint is `20260922120000`.

## Safety boundary

The baseline is outside `supabase/migrations`, so normal linked `db push` operations never treat it as a pending migration.

The bootstrap and verification scripts:

- require an explicit PostgreSQL URL and `-ConfirmDisposable`;
- accept only `localhost` or `127.0.0.1` targets;
- reject the `postgres` database on port `54322`, which is Tharwati's default local database (a separately named disposable database in the same local PostgreSQL container remains valid);
- never use `--linked`, a project reference, or remote credentials;
- contain no command that resets the default local database;
- use Supabase migration repair only against the explicit disposable URL.

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

Start a separate Supabase project with a different project ID and ports. Do not point these scripts at the repository's default local stack.

From the repository root:

```powershell
./scripts/database/create-fresh-environment.ps1 `
  -DbUrl $env:THARWATI_DISPOSABLE_DB_URL `
  -SupabaseWorkdir $PWD `
  -ConfirmDisposable
```

The supplied database must already be an empty Supabase-managed database. The script restores schema and reference data, records migration versions through the checkpoint with `supabase migration repair`, applies only newer migrations, runs database lint, and runs baseline verification.

If `psql` is unavailable locally, the scripts use the official `postgres:17-alpine` image as a client. Docker must then be running and the database port must be reachable from `host.docker.internal`.

## Verification coverage

Verification checks:

- baseline artifact SHA-256 hashes and credential patterns;
- represented migration history and checkpoint;
- expected tables, RPCs, views, indexes, constraints, triggers, and policies;
- RLS on every public table;
- fixed empty `search_path` on every public `SECURITY DEFINER` function;
- the Auth profile trigger;
- anonymous table grants and Goal delete grants;
- exact static catalogue counts;
- absence of custom catalogue and user/private rows;
- a deterministic catalog fingerprint covering relations, columns, constraints, functions, policies, triggers, ACLs, RLS, and routine configuration.

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
