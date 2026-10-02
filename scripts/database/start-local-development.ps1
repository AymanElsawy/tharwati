[CmdletBinding()]
param([switch] $ServeFunctions)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$workdir = Join-Path $repoRoot 'mobile-development.local'
$supabaseDir = Join-Path $workdir 'supabase'
$template = Join-Path $PSScriptRoot 'local-development.config.toml'
$markerPath = Join-Path $workdir 'bootstrap-complete.json'
New-Item -ItemType Directory -Force $supabaseDir | Out-Null
if (Test-Path (Join-Path $supabaseDir '.temp/project-ref')) { throw 'Refusing linked workdir.' }
if ((Test-Path (Join-Path $supabaseDir 'migrations')) -or (Test-Path (Join-Path $supabaseDir 'seed.sql'))) {
  throw 'Development workdir must contain no migrations or seed.sql. Use the approved fresh bootstrap only.'
}
$configPath = Join-Path $supabaseDir 'config.toml'
if (Test-Path $configPath) {
  if ((Get-FileHash $configPath).Hash -ne (Get-FileHash $template).Hash) {
    throw 'Local config differs from the supported dedicated-stack template; review before proceeding.'
  }
} else { Copy-Item -LiteralPath $template -Destination $configPath }

# Copy only versioned runtime source, never repository .env files or hosted credentials.
$functionRoot = Join-Path $repoRoot 'supabase/functions'
foreach ($file in Get-ChildItem -LiteralPath $functionRoot -Recurse -File -Filter '*.ts') {
  if ($file.Name -like '*.test.ts') { continue }
  $relative = $file.FullName.Substring($functionRoot.Length + 1)
  $destination = Join-Path $supabaseDir "functions/$relative"
  New-Item -ItemType Directory -Force (Split-Path $destination -Parent) | Out-Null
  Copy-Item -LiteralPath $file.FullName -Destination $destination
}
# An explicit empty env file suppresses all auto-discovered provider .env files.
$envFile = Join-Path $workdir 'functions.env'
Set-Content -LiteralPath $envFile -Value '# No external provider secrets in the supported smoke environment.' -Encoding ASCII

$artifacts = @(Get-ChildItem (Join-Path $repoRoot 'supabase/baselines/20260922120000_*') -File)
$artifacts += @(Get-ChildItem (Join-Path $repoRoot 'supabase/migrations') -File -Filter '*.sql' |
  Where-Object { $_.Name.Substring(0,14) -gt '20260922120000' })
$signature = ($artifacts | Sort-Object Name | ForEach-Object { "$($_.Name):$((Get-FileHash $_.FullName -Algorithm SHA256).Hash)" }) -join "`n"
if (Test-Path $markerPath) {
  $marker = Get-Content $markerPath -Raw | ConvertFrom-Json
  if ($marker.signature -ne $signature) {
    throw 'Bootstrap inputs changed. Reconstruct a reviewed fresh dedicated environment; do not db reset or replay history.'
  }
}

# Never print status credentials to the terminal/log; keep them only in the ignored workdir.
$startLog = Join-Path $workdir 'start.log'
$ErrorActionPreference = 'Continue' # CLI progress on native stderr is not a failure.
& npx.cmd --yes supabase@2.117.0 start --workdir $workdir -x studio,postgres-meta,logflare,vector,realtime,imgproxy,edge-runtime *> $startLog
$ErrorActionPreference = 'Stop'
if ($LASTEXITCODE -ne 0) { throw "Dedicated stack startup failed; inspect ignored $startLog" }
if (-not (Test-Path $markerPath)) {
  & (Join-Path $PSScriptRoot 'create-fresh-environment.ps1') `
    -DbUrl 'postgresql://postgres:postgres@127.0.0.1:58322/postgres' `
    -SupabaseWorkdir $workdir -ConfirmDisposable
  @{ signature = $signature; checkpoint = '20260922120000'; projectId = 'TharwatiMobileDevelopment' } |
    ConvertTo-Json | Set-Content -LiteralPath $markerPath -Encoding UTF8
}
$ErrorActionPreference = 'Continue'
$status = & npx.cmd --yes supabase@2.117.0 status --workdir $workdir -o json
$ErrorActionPreference = 'Stop'
if ($LASTEXITCODE -ne 0) { throw 'Dedicated local status failed.' }
$status -join "`n" | Set-Content -LiteralPath (Join-Path $workdir 'status.json') -Encoding UTF8
Write-Host 'Dedicated local API: http://127.0.0.1:58321; emulator: http://10.0.2.2:58321'
Write-Host 'Local status/keys: mobile-development.local/status.json (ignored; contains local privileged keys too).'
if ($ServeFunctions) {
  # Each function validates the caller with local Auth itself. This avoids the legacy
  # gateway JWT verifier rejecting tokens signed by the current local Auth keys.
  $ErrorActionPreference = 'Continue'
  # 2.117.0's Edge Runtime v1.74.3 crashes on this host before startup. The
  # independently pinned function server uses the verified v1.74.2 image.
  & npx.cmd --yes supabase@2.111.0 functions serve --workdir $workdir --env-file $envFile --no-verify-jwt
  $ErrorActionPreference = 'Stop'
  if ($LASTEXITCODE -ne 0) { throw 'Local function server exited unsuccessfully.' }
} else {
  Write-Host 'Next: ./scripts/database/start-local-development.ps1 -ServeFunctions (keep running in another terminal).'
}
