[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string] $DbUrl,

  [string] $ManifestPath = (Join-Path $PSScriptRoot '../../supabase/baselines/20260922120000_manifest.json'),

  [Parameter(Mandatory = $true)]
  [switch] $ConfirmDisposable,

  [switch] $AllowDefaultLocalRecovery
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
    throw 'Refusing non-local database host. Baseline verification is disposable/local only.'
  }
  if ($uri.Port -eq 54322 -and $uri.AbsolutePath.Trim('/') -eq 'postgres' -and -not $AllowDefaultLocalRecovery) {
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

function Invoke-DatabaseScalar {
  param([string] $Sql)

  $targetUri = [Uri] $DbUrl
  if ($AllowDefaultLocalRecovery -and $targetUri.Port -eq 54322 -and $targetUri.AbsolutePath.Trim('/') -eq 'postgres') {
    $result = & docker exec supabase_db_Tharwati psql -U postgres -d postgres -X --set=ON_ERROR_STOP=1 --tuples-only --no-align --command $Sql
  } else {
    $psql = Get-Command psql -ErrorAction SilentlyContinue
    if ($null -ne $psql) {
    $result = & $psql.Source -X $DbUrl --set=ON_ERROR_STOP=1 --tuples-only --no-align --command $Sql
    } else {
      $dockerUrl = ConvertTo-DockerDatabaseUrl $DbUrl
      $result = & docker run --rm postgres:17-alpine psql -X $dockerUrl --set=ON_ERROR_STOP=1 --tuples-only --no-align --command $Sql
    }
  }
  if ($LASTEXITCODE -ne 0) {
    throw "Database verification query failed with exit code $LASTEXITCODE."
  }
  return (($result | Out-String).Trim())
}

function Assert-DatabaseValue {
  param(
    [string] $Name,
    [string] $Sql,
    [string] $Expected
  )

  $actual = Invoke-DatabaseScalar $Sql
  if ($actual -ne $Expected) {
    throw "$Name failed. Expected '$Expected', received '$actual'."
  }
  Write-Host "PASS $Name"
}

Assert-DisposableDatabaseUrl $DbUrl

$manifestFile = (Resolve-Path $ManifestPath).Path
$manifest = Get-Content -LiteralPath $manifestFile -Raw | ConvertFrom-Json
$baselineRoot = Split-Path $manifestFile -Parent

foreach ($artifact in $manifest.artifacts.PSObject.Properties) {
  $artifactPath = Join-Path $baselineRoot $artifact.Value.file
  $actualHash = (Get-FileHash -LiteralPath $artifactPath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualHash -ne $artifact.Value.sha256) {
    throw "SHA-256 mismatch for $($artifact.Value.file)."
  }
}
Write-Host 'PASS baseline artifact SHA-256 hashes'

$secretPatterns = @(
  'postgres(?:ql)?://[^\s]+:[^\s]+@',
  'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}',
  'sb_(?:secret|publishable)_[A-Za-z0-9_-]+',
  'SUPABASE_(?:DB_PASSWORD|SERVICE_ROLE_KEY|ANON_KEY)\s*='
)
foreach ($artifact in $manifest.artifacts.PSObject.Properties) {
  $content = Get-Content -LiteralPath (Join-Path $baselineRoot $artifact.Value.file) -Raw
  foreach ($pattern in $secretPatterns) {
    if ($content -match $pattern) {
      throw "Potential credential or secret found in $($artifact.Value.file)."
    }
  }
}
Write-Host 'PASS no credentials or project secrets in baseline artifacts'

Assert-DatabaseValue 'checkpoint migration history' @"
select case when count(*) = $($manifest.representedMigrationVersions.Count)
  and max(version) = '$($manifest.checkpoint)' then 'ok' else 'mismatch' end
from supabase_migrations.schema_migrations
where version = any(array[$(($manifest.representedMigrationVersions | ForEach-Object { "'$_'" }) -join ',')]::text[]);
"@ 'ok'

$databaseHead = Invoke-DatabaseScalar 'select max(version) from supabase_migrations.schema_migrations;'
$isCheckpointState = $databaseHead -eq $manifest.checkpoint
if ($isCheckpointState) {
  Assert-DatabaseValue 'public table count' "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p');" ([string] $manifest.expectedObjects.tables)
  Assert-DatabaseValue 'public function count' "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public';" ([string] $manifest.expectedObjects.functions)
  Assert-DatabaseValue 'public view count' "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('v','m');" ([string] $manifest.expectedObjects.views)
  Assert-DatabaseValue 'public index count' "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='i';" ([string] $manifest.expectedObjects.indexes)
  Assert-DatabaseValue 'public constraint count' "select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public';" ([string] $manifest.expectedObjects.constraints)
  Assert-DatabaseValue 'public policy count' "select count(*) from pg_policies where schemaname='public';" ([string] $manifest.expectedObjects.policies)
  Assert-DatabaseValue 'public trigger count plus auth integration' "select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and (n.nspname='public' or (n.nspname='auth' and c.relname='users' and t.tgname='on_auth_user_created'));" ([string] $manifest.expectedObjects.triggers)
} else {
  Write-Host "INFO database head $databaseHead is newer than baseline checkpoint; exact checkpoint counts and fingerprint will be skipped."
}

$expectedTables = ($manifest.expectedTables | ForEach-Object { "'$_'" }) -join ','
Assert-DatabaseValue 'expected tables' "select count(*) from unnest(array[$expectedTables]::text[]) e(name) where to_regclass('public.' || e.name) is null;" '0'

$expectedRpcs = ($manifest.expectedRpcs | ForEach-Object { "'$_'" }) -join ','
Assert-DatabaseValue 'expected RPCs' "select count(*) from unnest(array[$expectedRpcs]::text[]) e(name) where not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=e.name);" '0'

Assert-DatabaseValue 'RLS on every public table' "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity;" '0'
Assert-DatabaseValue 'SECURITY DEFINER fixed search_path' "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig,array[]::text[])) cfg(setting) where setting = 'search_path=' || chr(34) || chr(34));" '0'
Assert-DatabaseValue 'auth profile trigger' "select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace join pg_proc p on p.oid=t.tgfoid join pg_namespace fn on fn.oid=p.pronamespace where n.nspname='auth' and c.relname='users' and t.tgname='on_auth_user_created' and not t.tgisinternal and fn.nspname='public' and p.proname='handle_new_user';" '1'
Assert-DatabaseValue 'anon public table grants' "select count(*) from information_schema.role_table_grants where table_schema='public' and grantee='anon';" '0'
Assert-DatabaseValue 'authenticated cannot directly delete goals/history' "select count(*) from information_schema.role_table_grants where table_schema='public' and grantee='authenticated' and privilege_type='DELETE' and table_name in ('goals','goal_progress_entries');" '0'
Assert-DatabaseValue 'authenticated delete_goal execute' "select has_function_privilege('authenticated','public.delete_goal(uuid)','EXECUTE')::text;" 'true'
Assert-DatabaseValue 'anon delete_goal execute denied' "select has_function_privilege('anon','public.delete_goal(uuid)','EXECUTE')::text;" 'false'

Assert-DatabaseValue 'required account type catalogue' "select count(*) from public.account_types where is_active and code in ('cash','bank','brokerage','gold','real_estate','business','other');" '7'
Assert-DatabaseValue 'required asset type catalogue' "select count(*) from public.asset_types where is_active and code in ('stock','etf','mutual_fund','bond','cryptocurrency','commodity','real_estate','business','cash_equivalent','other');" '10'
Assert-DatabaseValue 'required transaction type catalogue' "select count(*) from public.transaction_types where is_active and code in ('income','expense','transfer','investment_purchase','investment_purchase_reversal','opening_position','opening_position_reversal','buy','sell','dividend','adjustment','account_disposal_proceeds','refund','refund_cancellation');" '14'
Assert-DatabaseValue 'required currency catalogue' "select count(*) from public.currencies where is_active and code in ('USD','SAR','EGP','EUR','GBP','AED');" '6'
Assert-DatabaseValue 'required system category catalogue' "select count(*) from public.record_categories where user_id is null and system_code is not null;" '107'
Assert-DatabaseValue 'no custom category rows' "select count(*) from public.record_categories where user_id is not null or system_code is null;" '0'

$privateTables = @(
  'profiles','financial_accounts','financial_transactions','transaction_entries',
  'assets','asset_identifiers','holdings','metal_purchases','metal_purchase_lifecycle_events',
  'account_disposals','account_valuations','exchange_rates','market_prices',
  'dashboard_valuation_snapshots','goals','goal_progress_entries',
  'record_category_overrides','user_data_export_rate_limits',
  'wealth_allocation_targets','wealth_allocation_target_preferences'
)
$privateUnion = ($privateTables | ForEach-Object { "select '$_' as table_name, count(*)::bigint as row_count from public.$_" }) -join ' union all '
Assert-DatabaseValue 'no user/private rows' "select coalesce(sum(row_count),0) from ($privateUnion) rows;" '0'
Assert-DatabaseValue 'no Auth users' "select count(*) from auth.users;" '0'

$storageObjectsExists = Invoke-DatabaseScalar "select (to_regclass('storage.objects') is not null)::text;"
if ($storageObjectsExists -eq 'true') {
  Assert-DatabaseValue 'no Storage objects' 'select count(*) from storage.objects;' '0'
}

$fingerprintSql = @"
with components as (
  select 'relation|' || n.nspname || '|' || c.relname || '|' || c.relkind::text || '|' || c.relrowsecurity::text || '|' || coalesce(c.relacl::text,'') as value
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p','v','m','i','S')
  union all
  select 'column|' || n.nspname || '|' || c.relname || '|' || a.attnum::text || '|' || a.attname || '|' || pg_catalog.format_type(a.atttypid,a.atttypmod) || '|' || a.attnotnull::text || '|' || coalesce(pg_get_expr(d.adbin,d.adrelid),'')
  from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
  where n.nspname='public' and a.attnum>0 and not a.attisdropped
  union all
  select 'constraint|' || conname || '|' || pg_get_constraintdef(oid,true) from pg_constraint where connamespace='public'::regnamespace
  union all
  select 'function|' || p.proname || '|' || pg_get_function_identity_arguments(p.oid) || '|' || p.prosecdef::text || '|' || coalesce(p.proconfig::text,'') || '|' || pg_get_functiondef(p.oid)
  from pg_proc p where p.pronamespace='public'::regnamespace
  union all
  select 'policy|' || schemaname || '|' || tablename || '|' || policyname || '|' || cmd || '|' || coalesce(qual,'') || '|' || coalesce(with_check,'') from pg_policies where schemaname='public'
  union all
  select 'trigger|' || n.nspname || '|' || c.relname || '|' || t.tgname || '|' || pg_get_triggerdef(t.oid,true)
  from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
  where not t.tgisinternal and (n.nspname='public' or (n.nspname='auth' and c.relname='users' and t.tgname='on_auth_user_created'))
)
select md5(string_agg(value, E'\n' order by value)) from components;
"@
$actualFingerprint = Invoke-DatabaseScalar $fingerprintSql
if ($isCheckpointState) {
  if ($manifest.schemaFingerprint.algorithm -ne 'md5-catalog-v1' -or $actualFingerprint -ne $manifest.schemaFingerprint.value) {
    throw "Schema fingerprint mismatch. Expected $($manifest.schemaFingerprint.value), received $actualFingerprint."
  }
  Write-Host "PASS schema fingerprint $actualFingerprint"
} else {
  Write-Host "INFO post-checkpoint schema fingerprint $actualFingerprint"
}
Write-Host 'Baseline verification completed successfully.'
