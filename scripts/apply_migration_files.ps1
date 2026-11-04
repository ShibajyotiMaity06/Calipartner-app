param(
  [Parameter(Mandatory = $true)][string[]]$MigrationNames,
  [switch]$Apply
)
$ErrorActionPreference = 'Stop'
$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$credentialSource = Join-Path $env:LOCALAPPDATA 'CaliPartner/SupabaseCredential.cs'
if (-not ('CaliSupabaseCredential' -as [type])) { Add-Type -Path $credentialSource }
$projectReference = [System.IO.File]::ReadAllText((Join-Path $repositoryRoot 'supabase/.temp/project-ref')).Trim()
if ($projectReference -notmatch '^[a-z]{20}$') { throw 'Invalid linked project reference.' }
$managementHeaders = @{ Authorization = 'Bearer ' + [CaliSupabaseCredential]::Read() }
$managementUrl = 'https://api.supabase.com/v1/projects/' + $projectReference + '/database/query'
function Invoke-MigrationQuery([string]$Query) {
  Invoke-RestMethod -Method Post -Uri $managementUrl -Headers $managementHeaders -ContentType 'application/json' -Body (@{ query = $Query } | ConvertTo-Json -Compress) -TimeoutSec 120
}
$history = @(Invoke-MigrationQuery 'select version from supabase_migrations.schema_migrations order by version')
$latestVersion = ($history | Select-Object -Last 1).version
foreach ($migrationName in ($MigrationNames | Sort-Object)) {
  if ($migrationName -notmatch '^(\d{14})_[a-z0-9_]+\.sql$') { throw 'Invalid migration filename.' }
  $version = $Matches[1]
  $migrationPath = Join-Path $repositoryRoot ('supabase/migrations/' + $migrationName)
  $migrationSql = [System.IO.File]::ReadAllText($migrationPath)
  if ($history.version -contains $version) { Write-Output ('Already recorded: ' + $migrationName); continue }
  if ($version -le $latestVersion) { throw ('Refusing to replay an unrecorded historical migration: ' + $migrationName) }
  if (-not $Apply) { Write-Output ('Ready: ' + $migrationName); continue }
  $encodedMigration = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($migrationSql))
  $migrationLabel = $migrationName.Substring(15, $migrationName.Length - 19)
  # Schema changes and their exact source statement are recorded in one transaction.
  # Historic gaps are neither replayed nor falsely marked as applied.
  $transactionSql = @"
begin;
set local lock_timeout='10s';
select pg_advisory_xact_lock(hashtextextended('calipartner-versioned-deploy',84));
do `$versioned_migration`$
declare migration_source text:=convert_from(decode('$encodedMigration','base64'),'UTF8');
begin
 if not exists(select 1 from supabase_migrations.schema_migrations where version='$version') then
  execute migration_source;
  insert into supabase_migrations.schema_migrations(version,name,statements) values('$version','$migrationLabel',array[migration_source]);
 end if;
end;
`$versioned_migration`$;
commit;
"@
  $null = Invoke-MigrationQuery $transactionSql
  Write-Output ('Applied and recorded: ' + $migrationName)
}
