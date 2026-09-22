[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string] $DbUrl,

  [Parameter(Mandatory = $true)]
  [string] $SupabaseWorkdir,

  [Parameter(Mandatory = $true)]
  [switch] $ConfirmDisposable,

  [string] $ManifestPath = (Join-Path $PSScriptRoot '../../supabase/baselines/20260922120000_manifest.json')
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Assert-DisposableDatabaseUrl {
  param([string] $Url)

  $uri = [Uri] $Url
  if ($uri.Scheme -notin @('postgres', 'postgresql')) {
    throw 'DbUrl must use the postgres or postgresql scheme.'
  }
  if ($uri.Host -notin @('127.0.0.1', 'localhost')) {
    throw 'Refusing non-local database host. Bootstrap is disposable/local only.'
  }
  if ($uri.Port -eq 54322 -and $uri.AbsolutePath.Trim('/') -eq 'postgres') {
    throw 'Refusing the Tharwati default local Supabase postgres database on port 54322.'
  }
  if (-not $ConfirmDisposable) {
    throw 'Pass -ConfirmDisposable to acknowledge that the explicitly supplied database is disposable.'
  }
}

function ConvertTo-DockerDatabaseUrl {
  param([string] $Url)

  $builder = [UriBuilder] $Url
  if ($builder.Host -in @('127.0.0.1', 'localhost')) {
    $builder.Host = 'host.docker.internal'
  }
  return $builder.Uri.AbsoluteUri
}

function Invoke-SqlFile {
  param([string] $Path)

  Write-Host "Restoring $(Split-Path $Path -Leaf)..."
  $psql = Get-Command psql -ErrorAction SilentlyContinue
  if ($null -ne $psql) {
    Get-Content -LiteralPath $Path -Raw | & $psql.Source -X $DbUrl --set=ON_ERROR_STOP=1
  } else {
    $dockerUrl = ConvertTo-DockerDatabaseUrl $DbUrl
    Get-Content -LiteralPath $Path -Raw | & docker run --rm -i postgres:17-alpine psql -X $dockerUrl --set=ON_ERROR_STOP=1
  }
  if ($LASTEXITCODE -ne 0) {
    throw "Restore failed for $Path with exit code $LASTEXITCODE."
  }
}

function Invoke-SupabaseCli {
  param([string[]] $Arguments)

  $process = Start-Process -FilePath 'npx.cmd' -ArgumentList (@('--yes', 'supabase@latest') + $Arguments) -NoNewWindow -Wait -PassThru
  if ($process.ExitCode -ne 0) {
    throw "Supabase CLI failed with exit code $($process.ExitCode): $($Arguments -join ' ')"
  }
}

Assert-DisposableDatabaseUrl $DbUrl
$workdir = (Resolve-Path $SupabaseWorkdir).Path
$manifestFile = (Resolve-Path $ManifestPath).Path
$manifest = Get-Content -LiteralPath $manifestFile -Raw | ConvertFrom-Json
$baselineRoot = Split-Path $manifestFile -Parent

if (-not (Test-Path (Join-Path $workdir 'supabase/config.toml'))) {
  throw 'SupabaseWorkdir must contain supabase/config.toml.'
}

Invoke-SqlFile (Join-Path $baselineRoot $manifest.artifacts.schema.file)
Invoke-SqlFile (Join-Path $baselineRoot $manifest.artifacts.referenceData.file)

$versions = @($manifest.representedMigrationVersions)
Write-Host "Recording $($versions.Count) represented migration versions through $($manifest.checkpoint)..."
Invoke-SupabaseCli (@('migration', 'repair', '--status', 'applied', '--db-url', $DbUrl) + $versions + @('--workdir', $workdir))

Write-Host 'Applying migrations newer than the baseline checkpoint...'
Invoke-SupabaseCli @('migration', 'up', '--db-url', $DbUrl, '--workdir', $workdir)

Write-Host 'Running database lint...'
Invoke-SupabaseCli @('db', 'lint', '--db-url', $DbUrl, '--schema', 'public', '--level', 'error', '--fail-on', 'error', '--workdir', $workdir)

& (Join-Path $PSScriptRoot 'verify-baseline.ps1') -DbUrl $DbUrl -ManifestPath $manifestFile -ConfirmDisposable
if ($LASTEXITCODE -ne 0) {
  throw "Baseline verification failed with exit code $LASTEXITCODE."
}

Write-Host "Disposable database bootstrap completed at checkpoint $($manifest.checkpoint)."
