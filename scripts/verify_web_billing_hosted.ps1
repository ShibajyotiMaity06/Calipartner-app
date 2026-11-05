param([string]$WebOrigin = 'https://calipartner.app')
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
  if ($Path -eq '/rest/v1/profiles') { $options.Headers.Prefer = 'resolution=merge-duplicates' }
  if ($null -ne $Body) { $options.Body = ConvertTo-Json -InputObject $Body -Depth 8 -Compress }
  try { return @{ status = 200; data = (Invoke-RestMethod @options) } }
  catch {
    if (-not $_.Exception.Response) { throw }
    $response = $_.Exception.Response
    $reader = New-Object IO.StreamReader($response.GetResponseStream())
    try { $payload = $reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose() }
    return @{ status = [int]$response.StatusCode; data = $payload }
  }
}
function Assert-BillingCheck([bool]$Passed, [string]$Description) { if (-not $Passed) { throw ('Hosted billing check failed: ' + $Description) } }
$fixtureId = $null
try {
  $suffix = [guid]::NewGuid().ToString('N').Substring(0, 10)
  $email = 'billingcheck_' + $suffix + '@example.invalid'
  $password = [guid]::NewGuid().ToString('N') + 'aA8!'
  $created = Invoke-BillingCheck 'POST' '/auth/v1/admin/users' @{ email = $email; password = $password; email_confirm = $true; user_metadata = @{ fixture = 'web-billing-routing-check' } } $serviceKey $serviceKey
  Assert-BillingCheck ($created.status -eq 200 -and [bool]$created.data.id) 'fixture account created'
  $fixtureId = $created.data.id
  $profile = @{ id = $fixtureId; username = 'bill_' + $suffix; nickname = 'Billing check'; date_of_birth = '1995-01-01'; sex = 'male'; height_cm = 175; timezone = 'UTC'; country = 'IN'; discoverable = $false }
  Assert-BillingCheck ((Invoke-BillingCheck 'POST' '/rest/v1/profiles' $profile $serviceKey $serviceKey).status -eq 200) 'fixture profile saved'
  $session = Invoke-BillingCheck 'POST' '/auth/v1/token?grant_type=password' @{ email = $email; password = $password } $anonKey $anonKey
  $token = $session.data.access_token
  Assert-BillingCheck ([bool]$token) 'fixture authenticated'
  $india = Invoke-BillingCheck 'POST' '/functions/v1/web-billing' @{ action = 'catalog' } $token
  Assert-BillingCheck ($india.data.provider -eq 'razorpay' -and $india.status -in @(200, 403, 503)) 'India routes exclusively to Razorpay'
  if ($india.status -eq 200) { Assert-BillingCheck ($india.data.products.Count -eq 4 -and @($india.data.products | Where-Object { $_.currency -ne 'INR' }).Count -eq 0) 'configured INR catalog verified' }
  $bypass = Invoke-BillingCheck 'POST' '/functions/v1/dodo-checkout' @{ action = 'catalog' } $token
  Assert-BillingCheck ($bypass.status -eq 403 -and $bypass.data.error -eq 'WRONG_BILLING_PROVIDER') 'India cannot bypass the router into Dodo'
  $profile.country = 'US'
  Assert-BillingCheck ((Invoke-BillingCheck 'POST' '/rest/v1/profiles' $profile $serviceKey $serviceKey).status -eq 200) 'international fixture profile saved'
  $international = Invoke-BillingCheck 'POST' '/functions/v1/web-billing' @{ action = 'catalog' } $token
  Assert-BillingCheck ($international.status -eq 200 -and $international.data.provider -eq 'dodo' -and $international.data.products.Count -eq 4 -and @($international.data.products | Where-Object { $_.currency -ne 'USD' }).Count -eq 0) 'international catalog verifies all four Dodo USD products'
  $checkouts = Invoke-BillingCheck 'GET' ('/rest/v1/web_billing_checkouts?user_id=eq.' + $fixtureId + '&select=id') $null $token
  Assert-BillingCheck ($checkouts.status -eq 200 -and @($checkouts.data).Count -eq 0) 'catalog checks create no checkout or subscription'
  $detected = Invoke-BillingCheck 'POST' '/functions/v1/web-billing' @{ action = 'routing' } $token
  Assert-BillingCheck ($detected.status -eq 200 -and $detected.data.country -match '^[A-Z]{2}$') 'IP country detected without a dropdown'
  $expectedProvider = if ($detected.data.country -eq 'IN') { 'razorpay' } else { 'dodo' }
  Assert-BillingCheck ($detected.data.provider -eq $expectedProvider) 'automatic country selects the matching payment provider'
  $savedCountry = Invoke-BillingCheck 'GET' ('/rest/v1/profiles?id=eq.' + $fixtureId + '&select=country') $null $token
  Assert-BillingCheck ($savedCountry.status -eq 200 -and $savedCountry.data[0].country -eq $detected.data.country) 'detected country saved and acknowledged'
  Write-Output ('Hosted IP country detection passed: ' + $detected.data.country + ' / ' + $detected.data.provider + ', with acknowledged profile persistence.')
  Write-Output ('Hosted web billing routing passed: Indian Razorpay route (HTTP ' + $india.status + '), direct Dodo denial, four actual international USD products, and no checkout/subscription creation.')
} finally {
  if ($fixtureId) { Assert-BillingCheck ((Invoke-BillingCheck 'DELETE' ('/auth/v1/admin/users/' + $fixtureId) $null $serviceKey $serviceKey).status -eq 200) 'fixture cleanup' }
  Write-Output 'Hosted billing fixture cleanup completed.'
}
