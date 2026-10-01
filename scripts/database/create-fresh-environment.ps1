[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)] [string] $DbUrl,
  [Parameter(Mandatory = $true)] [string] $SupabaseWorkdir,
  [Parameter(Mandatory = $true)] [switch] $ConfirmDisposable,
  [string] $ManifestPath = (Join-Path $PSScriptRoot '../../supabase/baselines/20260922120000_manifest.json')
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
# Windows PowerShell otherwise encodes native stdin as ASCII, corrupting Arabic catalogues.
$OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$uri = [Uri] $DbUrl
if (-not $ConfirmDisposable) { throw 'Pass -ConfirmDisposable for a fresh/disposable local Supabase stack.' }
if ($uri.Scheme -notin @('postgres', 'postgresql') -or $uri.Host -notin @('localhost', '127.0.0.1')) {
  throw 'Refusing non-local PostgreSQL target.'
}
if ($uri.Port -le 0 -or $uri.Port -eq 54322 -or $uri.AbsolutePath -ne '/postgres' -or $uri.Query -or $uri.Fragment) {
  throw 'Use the postgres database on an explicit disposable port other than 54322, without URL query parameters.'
}
$workdir = (Resolve-Path $SupabaseWorkdir).Path
if ($workdir -eq $repoRoot -or (Test-Path (Join-Path $workdir 'supabase/.temp/project-ref'))) {
  throw 'Use a separate, unlinked disposable Supabase workdir, not the repository workdir.'
}
$config = Get-Content -LiteralPath (Join-Path $workdir 'supabase/config.toml') -Raw
if ($config -notmatch '(?m)^project_id\s*=\s*"([A-Za-z0-9_-]+)"') { throw 'Missing safe local project_id.' }
$projectId = $Matches[1]
if ($projectId -ieq 'Tharwati') { throw 'Refusing the default Tharwati stack.' }
$container = "supabase_db_$projectId"
$inspection = & docker inspect $container
if ($LASTEXITCODE -ne 0) { throw 'Start the separate disposable Supabase stack first.' }
$details = @($inspection | ConvertFrom-Json)[0]
if (-not $details.State.Running) { throw 'Disposable database container must be running.' }
$bindings = @($details.NetworkSettings.Ports.'5432/tcp')
if (-not ($bindings | Where-Object { $_.HostPort -eq [string] $uri.Port })) {
  throw 'DbUrl port must map directly to the disposable Supabase Docker database container.'
}
# SQL runs inside this verified local container, never through the supplied URL.
function Invoke-LocalSql {
  param([string] $Sql)
  # Native stderr includes harmless PostgreSQL NOTICEs in Windows PowerShell.
  # SQL failure is determined by psql's checked exit code, not stderr presence.
  $ErrorActionPreference = 'Continue'
  $output = $Sql | & docker exec -i $container psql -U postgres -d postgres -X --set=ON_ERROR_STOP=1 --tuples-only --no-align 2>&1
  if ($LASTEXITCODE -ne 0) { throw "SQL failed; discard this environment before retrying.`n$($output -join "`n")" }
  return ($output -join "`n").Trim()
}
function Invoke-SqlFile {
  param([string] $Path)
  $output = Invoke-LocalSql (Get-Content -LiteralPath $Path -Raw -Encoding UTF8)
  if ($output -match '(?m)^not ok\b') { throw "DB assertions failed in ${Path}:`n$output" }
}

$manifestFile = (Resolve-Path $ManifestPath).Path
$manifest = Get-Content -LiteralPath $manifestFile -Raw | ConvertFrom-Json
if ($manifest.formatVersion -ne 1 -or $manifest.checkpoint -notmatch '^\d{14}$') { throw 'Unsupported baseline manifest.' }
$baselineRoot = Split-Path $manifestFile -Parent
foreach ($artifact in $manifest.artifacts.PSObject.Properties) {
  $path = Join-Path $baselineRoot $artifact.Value.file
  if ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $artifact.Value.sha256) {
    throw "SHA-256 mismatch for $($artifact.Value.file); no SQL loaded."
  }
}
Write-Host 'PASS baseline artifact SHA-256 hashes (before loading)'
$migrations = @(Get-ChildItem (Join-Path $repoRoot 'supabase/migrations') -File -Filter '*.sql' | Sort-Object Name)
foreach ($migration in $migrations) {
  if ($migration.Name -notmatch '^\d{14}_.+\.sql$') { throw "Invalid SQL migration filename: $($migration.Name)" }
}
$forward = @($migrations | Where-Object { $_.Name.Substring(0,14) -gt $manifest.checkpoint })
$duplicates = @($forward | Group-Object { $_.Name.Substring(0,14) } | Where-Object Count -gt 1)
if ($duplicates.Count) { throw 'Duplicate forward migration timestamps.' }
Write-Host "Baseline cutoff: $($manifest.checkpoint); forward SQL migrations: $($forward.Count)"
foreach ($migration in $forward) { Write-Host "PLAN $($migration.Name)" }

# Managed Supabase schemas exist, but application objects/data/history must be empty.
$null = Invoke-LocalSql @'
do $guard$
begin
  if exists (select 1 from pg_class where relnamespace='public'::regnamespace)
    or exists (select 1 from pg_proc where pronamespace='public'::regnamespace)
    or exists (select 1 from pg_type where typnamespace='public'::regnamespace)
    or exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private')
    or exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private')
    or exists (select 1 from auth.users)
    or exists (select 1 from auth.identities)
    or exists (select 1 from storage.objects)
    or exists (select 1 from storage.buckets) then
    raise exception 'Refusing nonempty environment; create a new disposable stack';
  end if;
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    if exists (select 1 from supabase_migrations.schema_migrations) then
      raise exception 'Refusing existing migration history';
    end if;
  end if;
end;
$guard$;
'@
Write-Host 'PASS empty local Supabase environment'
# Fresh Supabase installs permissive public default ACLs. A schema dump adds
# grants but does not revoke inherited defaults. Recreate ONLY the proven-empty
# schema so baseline ACLs, including denied anon table access, restore exactly.
$null = Invoke-LocalSql 'drop schema public; create schema public authorization pg_database_owner; grant usage on schema public to public;'
Invoke-SqlFile (Join-Path $baselineRoot $manifest.artifacts.schema.file)
Write-Host 'PASS baseline loaded'
Invoke-SqlFile (Join-Path $baselineRoot $manifest.artifacts.referenceData.file)
Write-Host 'PASS reference data loaded'
& (Join-Path $PSScriptRoot 'verify-baseline.ps1') -DbUrl $DbUrl -ManifestPath $manifestFile -ConfirmDisposable -VerificationStage BootstrapCheckpoint -LocalContainer $container
foreach ($migration in $forward) {
  Invoke-SqlFile $migration.FullName
  Write-Host "PASS migration applied: $($migration.Name)"
}
Write-Host "PASS migrations applied: $($forward.Count)"
& (Join-Path $PSScriptRoot 'verify-baseline.ps1') -DbUrl $DbUrl -ManifestPath $manifestFile -ConfirmDisposable -VerificationStage BootstrapCurrent -LocalContainer $container
Write-Host 'PASS schema ready'
# Focused integration coverage for forward migrations and their baseline dependency.
$tests = @(
  'goal_hard_delete.sql', 'account_record_idempotency.sql',
  'brokerage_mutation_idempotency.sql', 'account_create_idempotency.sql',
  'financial_history_immutability.sql', 'account_display_order.sql'
)
foreach ($test in $tests) {
  Invoke-SqlFile (Join-Path $repoRoot "supabase/tests/$test")
  Write-Host "PASS DB test: $test"
}
# Synthetic fixtures roll back; verify no user data remains after tests.
& (Join-Path $PSScriptRoot 'verify-baseline.ps1') -DbUrl $DbUrl -ManifestPath $manifestFile -ConfirmDisposable -VerificationStage BootstrapCurrent -LocalContainer $container
$null = Invoke-LocalSql @'
do $history$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    if exists (select 1 from supabase_migrations.schema_migrations) then
      raise exception 'Unexpected migration history after bootstrap';
    end if;
  end if;
end;
$history$;
'@
Write-Host "PASS tests result: $($tests.Count)/$($tests.Count); migration history untouched; schema ready"
