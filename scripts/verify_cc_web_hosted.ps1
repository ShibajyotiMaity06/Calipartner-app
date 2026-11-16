param([string]$WebOrigin = 'https://app.calipartner.site', [string]$TestIP = '')
$ErrorActionPreference = 'Stop'
if (-not ('CaliSupabaseCredential' -as [type])) { Add-Type -Path (Join-Path $env:LOCALAPPDATA 'CaliPartner/SupabaseCredential.cs') }
$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$projectRef = [IO.File]::ReadAllText((Join-Path $repositoryRoot 'supabase/.temp/project-ref')).Trim()
$managementHeaders = @{ Authorization = 'Bearer ' + [CaliSupabaseCredential]::Read() }
$keys = Invoke-RestMethod -Uri ('https://api.supabase.com/v1/projects/' + $projectRef + '/api-keys') -Headers $managementHeaders
$serviceKey = ($keys | Where-Object { $_.name -eq 'service_role' } | Select-Object -First 1).api_key
$anonKey = ($keys | Where-Object { $_.name -eq 'anon' } | Select-Object -First 1).api_key
$apiRoot = 'https://' + $projectRef + '.supabase.co'
function Invoke-BillingCheck([string]$Method, [string]$Path, $Body, [string]$Token, [string]$Key = $anonKey) {
  $options = @{ Method = $Method; Uri = $apiRoot + $Path; Headers = @{ apikey = $Key; Authorization = 'Bearer ' + $Token; Origin = $WebOrigin }; ContentType = 'application/json'; TimeoutSec = 60 }
  if ($TestIP) { $options.Headers['x-forwarded-for'] = $TestIP }
  if ($Path -eq '/rest/v1/profiles') { $options.Headers.Prefer = 'resolution=merge-duplicates' }
  if ($null -ne $Body) { $options.Body = ConvertTo-Json -InputObject $Body -Depth 8 -Compress }
  try { return @{ status = 200; data = (Invoke-RestMethod @options) } }
  catch {
    if (-not $_.Exception.Response) { throw }
    $response = $_.Exception.Response
    $payload = $null
    if ($_.ErrorDetails.Message) { try { $payload = $_.ErrorDetails.Message | ConvertFrom-Json } catch { $payload = $null } }
    if (-not $payload) {
      $reader = New-Object IO.StreamReader($response.GetResponseStream())
      try { $payload = $reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose() }
    }
    return @{ status = [int]$response.StatusCode; data = $payload }
  }
}
function Assert-BillingCheck([bool]$Passed, [string]$Description) { if (-not $Passed) { throw ('Hosted billing check failed: ' + $Description) } }
$fixtureId = $null
try {
  $suffix = [guid]::NewGuid().ToString('N').Substring(0,10)
  $email = 'cccheck_' + $suffix + '@example.invalid'
  $password = [guid]::NewGuid().ToString('N') + 'aA8!'
  $created = Invoke-BillingCheck 'POST' '/auth/v1/admin/users' @{email=$email;password=$password;email_confirm=$true} $serviceKey $serviceKey
  $fixtureId = $created.data.id
  Assert-BillingCheck ([bool]$fixtureId) 'fixture created'
  $session = Invoke-BillingCheck 'POST' '/auth/v1/token?grant_type=password' @{email=$email;password=$password} $anonKey $anonKey
  $token = $session.data.access_token
  foreach ($currency in @('INR','USD')) {
    $audit = Invoke-BillingCheck 'POST' '/functions/v1/cc-checkout' @{action='catalog';quote_currency=$currency} $token
    $audit | ConvertTo-Json -Depth 7
    Assert-BillingCheck ($audit.status -eq 200 -and $audit.data.products.Count -eq 5) ('five verified prices for ' + $currency)
  }

  $catalog = Invoke-BillingCheck 'POST' '/functions/v1/cc-checkout' @{action='catalog'} $token
  $catalog | ConvertTo-Json -Depth 6
  Assert-BillingCheck ($catalog.status -eq 200 -and $catalog.data.products.Count -eq 5) 'five actual CC prices loaded'
  $bad = Invoke-BillingCheck 'POST' '/functions/v1/cc-checkout' @{action='checkout';request_id=[guid]::NewGuid().ToString();pack_id=$catalog.data.products[0].id;amount=1;currency=$catalog.data.products[0].currency} $token
  Assert-BillingCheck ($bad.status -eq 409) 'forged quote blocked'
  Write-Output 'Hosted CC catalogue and forged-price checks passed; no checkout created.'
} finally {
  if ($fixtureId) { $null = Invoke-BillingCheck 'DELETE' ('/auth/v1/admin/users/' + $fixtureId) $null $serviceKey $serviceKey }
}
