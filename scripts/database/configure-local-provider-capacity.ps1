[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$workdir = Join-Path $repoRoot 'mobile-development.local'
if (Test-Path (Join-Path $workdir 'supabase/.temp/project-ref')) { throw 'Refusing linked workdir.' }
$status = Get-Content (Join-Path $workdir 'status.json') -Raw | ConvertFrom-Json
$marker = Get-Content (Join-Path $workdir 'bootstrap-complete.json') -Raw | ConvertFrom-Json
if ($status.API_URL -ne 'http://127.0.0.1:58321' -or $marker.projectId -ne 'TharwatiMobileDevelopment') {
  throw 'Refusing any environment other than dedicated Local Development.'
}
$ports = & docker inspect supabase_db_TharwatiMobileDevelopment --format '{{json .NetworkSettings.Ports}}' | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $ports.'5432/tcp'[0].HostPort -ne '58322') { throw 'Unexpected local DB port.' }
Get-Content (Join-Path $PSScriptRoot 'provider-capacity.development.sql') -Raw |
  & docker exec -i supabase_db_TharwatiMobileDevelopment psql -X -U postgres -d postgres --set=ON_ERROR_STOP=1 -1
if ($LASTEXITCODE -ne 0) { throw 'Development provider capacity configuration failed.' }
Write-Host 'Configured LOCAL DEVELOPMENT capacities only. These are not production recommendations.'
