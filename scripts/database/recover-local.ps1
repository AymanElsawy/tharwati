[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string] $DbUrl,

  [Parameter(Mandatory = $true)]
  [string] $BackupDirectory,

  [Parameter(Mandatory = $true)]
  [ValidateSet('RECOVER_DEFAULT_LOCAL_THARWATI')]
  [string] $Confirmation,

  [string] $SupabaseWorkdir = (Join-Path $PSScriptRoot '../..'),

  [string] $ManifestPath = (Join-Path $PSScriptRoot '../../supabase/baselines/20260922120000_manifest.json')
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Assert-DefaultLocalTarget {
  param([string] $Url)

  $uri = [Uri] $Url
  if ($uri.Scheme -notin @('postgres', 'postgresql')) {
    throw 'DbUrl must use the postgres or postgresql scheme.'
  }
  if ($uri.Host -notin @('127.0.0.1', 'localhost')) {
    throw 'Refusing non-local database host.'
  }
  if ($uri.Port -ne 54322 -or $uri.AbsolutePath.Trim('/') -ne 'postgres') {
    throw 'Recovery targets only the Tharwati default local postgres database on port 54322.'
  }
  if ($Confirmation -ne 'RECOVER_DEFAULT_LOCAL_THARWATI') {
    throw 'The exact recovery confirmation phrase is required.'
  }
}

function ConvertTo-DockerDatabaseUrl {
  param([string] $Url)

  $builder = [UriBuilder] $Url
  $builder.Host = 'host.docker.internal'
  return $builder.Uri.AbsoluteUri
}

function Invoke-SqlText {
  param([string] $Sql)

  $psql = Get-Command psql -ErrorAction SilentlyContinue
  if ($null -ne $psql) {
    $Sql | & $psql.Source -X $DbUrl --set=ON_ERROR_STOP=1
  } else {
    $dockerUrl = ConvertTo-DockerDatabaseUrl $DbUrl
    $Sql | & docker run --rm -i postgres:17-alpine psql -X $dockerUrl --set=ON_ERROR_STOP=1
  }
  if ($LASTEXITCODE -ne 0) {
    throw "Database command failed with exit code $LASTEXITCODE. Preserve the backup and stop recovery."
  }
}

function Invoke-SqlFile {
  param([string] $Path)

  Write-Host "Restoring $(Split-Path $Path -Leaf)..."
  Invoke-SqlText (Get-Content -LiteralPath $Path -Raw)
}

function Invoke-SupabaseCli {
  param([string[]] $Arguments)

  $process = Start-Process -FilePath 'npx.cmd' -ArgumentList (@('--yes', 'supabase@latest') + $Arguments) -NoNewWindow -Wait -PassThru
  if ($process.ExitCode -ne 0) {
    throw "Supabase CLI failed with exit code $($process.ExitCode): $($Arguments -join ' ')"
  }
}

Assert-DefaultLocalTarget $DbUrl
$workdir = (Resolve-Path $SupabaseWorkdir).Path
$manifestFile = (Resolve-Path $ManifestPath).Path
$manifest = Get-Content -LiteralPath $manifestFile -Raw | ConvertFrom-Json
$baselineRoot = Split-Path $manifestFile -Parent
$backupRoot = (Resolve-Path $BackupDirectory).Path
$backupMetadataPath = Join-Path $backupRoot 'restore-metadata.json'

if (-not (Test-Path (Join-Path $workdir 'supabase/config.toml'))) {
  throw 'SupabaseWorkdir must contain supabase/config.toml.'
}
if (-not (Test-Path $backupMetadataPath)) {
  throw 'Backup directory must contain restore-metadata.json.'
}

$backupMetadata = Get-Content -LiteralPath $backupMetadataPath -Raw | ConvertFrom-Json
if ($backupMetadata.sourceContainer -ne 'supabase_db_Tharwati' -or $backupMetadata.sourceDatabase -ne 'postgres') {
  throw 'Backup metadata does not identify the Tharwati default local database.'
}
foreach ($artifact in $backupMetadata.artifacts) {
  $artifactPath = Join-Path $backupRoot $artifact.file
  if (-not (Test-Path $artifactPath)) {
    throw "Backup artifact is missing: $($artifact.file)"
  }
  $actualHash = (Get-FileHash -LiteralPath $artifactPath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualHash -ne $artifact.sha256) {
    throw "Backup artifact hash mismatch: $($artifact.file)"
  }
}
Write-Host 'PASS backup archive integrity'

foreach ($artifact in $manifest.artifacts.PSObject.Properties) {
  $artifactPath = Join-Path $baselineRoot $artifact.Value.file
  $actualHash = (Get-FileHash -LiteralPath $artifactPath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualHash -ne $artifact.Value.sha256) {
    throw "Baseline artifact hash mismatch: $($artifact.Value.file)"
  }
}
Write-Host 'PASS baseline artifact integrity'

$replacementSql = @'
begin;
drop schema if exists public cascade;
create schema public authorization pg_database_owner;
grant usage on schema public to public;
truncate table auth.users cascade;
do $block$
begin
  if to_regclass('storage.objects') is not null then
    execute 'truncate table storage.objects cascade';
  end if;
  if to_regclass('storage.buckets') is not null then
    execute 'truncate table storage.buckets cascade';
  end if;
end;
$block$;
truncate table supabase_migrations.schema_migrations;
commit;
'@

Write-Host 'Replacing the default local application schema...'
Invoke-SqlText $replacementSql
Invoke-SqlFile (Join-Path $baselineRoot $manifest.artifacts.schema.file)
Invoke-SqlFile (Join-Path $baselineRoot $manifest.artifacts.referenceData.file)

$versions = @($manifest.representedMigrationVersions)
Write-Host "Recording $($versions.Count) represented migration versions through $($manifest.checkpoint)..."
Invoke-SupabaseCli (@('migration', 'repair', '--status', 'applied', '--db-url', $DbUrl) + $versions + @('--workdir', $workdir))

Write-Host 'Applying only migrations newer than the baseline checkpoint...'
Invoke-SupabaseCli @('migration', 'up', '--db-url', $DbUrl, '--workdir', $workdir)

Write-Host 'Running database lint...'
Invoke-SupabaseCli @('db', 'lint', '--db-url', $DbUrl, '--schema', 'public', '--level', 'error', '--fail-on', 'error', '--workdir', $workdir)

& (Join-Path $PSScriptRoot 'verify-baseline.ps1') `
  -DbUrl $DbUrl `
  -ManifestPath $manifestFile `
  -ConfirmDisposable `
  -AllowDefaultLocalRecovery

Write-Host "Default local database recovery completed at checkpoint $($manifest.checkpoint)."
