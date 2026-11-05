$ErrorActionPreference = 'Stop'
if (-not ('CaliSupabaseCredential' -as [type])) { Add-Type -Path (Join-Path $env:LOCALAPPDATA 'CaliPartner/SupabaseCredential.cs') }
$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$projectRef = [IO.File]::ReadAllText((Join-Path $repositoryRoot 'supabase/.temp/project-ref')).Trim()
$managementHeaders = @{ Authorization = 'Bearer ' + [CaliSupabaseCredential]::Read() }
$keys = Invoke-RestMethod -Uri ('https://api.supabase.com/v1/projects/' + $projectRef + '/api-keys') -Headers $managementHeaders
$serviceKey = ($keys | Where-Object { $_.name -eq 'service_role' } | Select-Object -First 1).api_key
$anonKey = ($keys | Where-Object { $_.name -eq 'anon' } | Select-Object -First 1).api_key
$apiRoot = 'https://' + $projectRef + '.supabase.co'
function Invoke-TrialCheck([string]$Method, [string]$Path, $Body, [string]$Token, [string]$Key = $anonKey) {
  $options = @{ Method = $Method; Uri = $apiRoot + $Path; Headers = @{ apikey = $Key; Authorization = 'Bearer ' + $Token }; ContentType = 'application/json'; TimeoutSec = 30 }
  if ($Path -eq '/rest/v1/profiles') { $options.Headers.Prefer = 'resolution=merge-duplicates' }
  if ($null -ne $Body) { $options.Body = ConvertTo-Json -InputObject $Body -Depth 8 -Compress }
  try { return @{ status = 200; data = (Invoke-RestMethod @options) } }
  catch {
    if (-not $_.Exception.Response) { throw }
    $response = $_.Exception.Response
    $payload = $null
    if ($_.ErrorDetails.Message) {
      try { $payload = $_.ErrorDetails.Message | ConvertFrom-Json } catch { $payload = $null }
    }
    if (-not $payload) {
      $reader = New-Object IO.StreamReader($response.GetResponseStream())
      try { $payload = $reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose() }
    }
    return @{ status = [int]$response.StatusCode; data = $payload }
  }
}
function Assert-Trial([bool]$Passed, [string]$Description) { if (-not $Passed) { throw ('Hosted cardless trial check failed: ' + $Description) } }
$fixtureIds = @()
$tokens = @()
$roomId = [guid]::NewGuid().ToString()
$createdRoom = $false
try {
  for ($index = 0; $index -lt 2; $index++) {
    $suffix = [guid]::NewGuid().ToString('N').Substring(0, 10)
    $email = 'trialcheck_' + $suffix + '@example.invalid'
    $password = [guid]::NewGuid().ToString('N') + 'aA8!'
    $created = Invoke-TrialCheck 'POST' '/auth/v1/admin/users' @{ email = $email; password = $password; email_confirm = $true; user_metadata = @{ fixture = 'cardless-trial-check' } } $serviceKey $serviceKey
    Assert-Trial ($created.status -eq 200 -and [bool]$created.data.id) 'fixture created'
    $fixtureIds += $created.data.id
    $profile = @{ id = $created.data.id; username = 'trial_' + $suffix; nickname = 'Trial check'; date_of_birth = '1995-01-01'; sex = 'male'; height_cm = 175; timezone = 'UTC'; discoverable = $false }
    Assert-Trial ((Invoke-TrialCheck 'POST' '/rest/v1/profiles' $profile $serviceKey $serviceKey).status -eq 200) 'fixture profile saved'
    $session = Invoke-TrialCheck 'POST' '/auth/v1/token?grant_type=password' @{ email = $email; password = $password } $anonKey $anonKey
    Assert-Trial ([bool]$session.data.access_token) 'fixture authenticated'
    $tokens += $session.data.access_token
  }
  $room = Invoke-TrialCheck 'POST' '/rest/v1/rpc/create_room_v3' @{ p_client_id = $roomId; p_name = 'Rename fixture' } $tokens[0]
  Assert-Trial ($room.status -eq 200 -and $room.data.room_id -eq $roomId) 'fixture squad created'
  $createdRoom = $true
  Assert-Trial ((Invoke-TrialCheck 'POST' '/rest/v1/rpc/join_by_code' @{ p_code = $room.data.code } $tokens[1]).status -eq 200) 'member joined'
  $device = 'hosted-trial-' + [guid]::NewGuid().ToString('N')
  $offer = Invoke-TrialCheck 'POST' '/rest/v1/rpc/get_plus_trial_offer' @{ p_device_hash = $device } $tokens[0]
  Assert-Trial ($offer.status -eq 200 -and $offer.data.eligible) 'eligible without billing country'
  $payload = @{ p_client_id = [guid]::NewGuid().ToString(); p_device_hash = $device }
  $claim = Invoke-TrialCheck 'POST' '/rest/v1/rpc/claim_plus_trial' $payload $tokens[0]
  Assert-Trial ($claim.status -eq 200 -and $claim.data.active -and -not $claim.data.eligible) 'trial acknowledged'
  Assert-Trial (([datetimeoffset]$claim.data.ends_at - [datetimeoffset]$claim.data.started_at).TotalDays -eq 7) 'exactly seven days'
  $retry = Invoke-TrialCheck 'POST' '/rest/v1/rpc/claim_plus_trial' $payload $tokens[0]
  Assert-Trial ($retry.data.ends_at -eq $claim.data.ends_at) 'safe replay'
  $deviceDenied = Invoke-TrialCheck 'POST' '/rest/v1/rpc/claim_plus_trial' @{ p_client_id = [guid]::NewGuid().ToString(); p_device_hash = $device } $tokens[1]
  Assert-Trial ($deviceDenied.status -eq 400 -and $deviceDenied.data.message -eq 'TRIAL_NOT_ELIGIBLE') 'same device denied for second account'
  foreach ($table in @('web_billing_checkouts','dodo_checkouts')) {
    $rows = Invoke-TrialCheck 'GET' ('/rest/v1/' + $table + '?user_id=eq.' + $fixtureIds[0] + '&select=id') $null $serviceKey $serviceKey
    Assert-Trial ($rows.status -eq 200 -and @($rows.data).Count -eq 0) 'trial creates no provider checkout'
  }
  $foreign = Invoke-TrialCheck 'GET' '/rest/v1/plus_trial_claims?select=id' $null $tokens[1]
  Assert-Trial ($foreign.status -eq 200 -and @($foreign.data).Count -eq 0) 'other account cannot read claim'
  $end = [datetimeoffset]::UtcNow.AddDays(-1); $start = $end.AddDays(-7)
  $oldTimes = @{ started_at = $start.ToString('o'); ends_at = $end.ToString('o') }
  Assert-Trial ((Invoke-TrialCheck 'PATCH' ('/rest/v1/plus_trial_claims?user_id=eq.' + $fixtureIds[0]) $oldTimes $serviceKey $serviceKey).status -eq 200) 'backdate disposable fixture only'
  Assert-Trial ((Invoke-TrialCheck 'PATCH' ('/rest/v1/entitlements?user_id=eq.' + $fixtureIds[0]) @{ trial_started_at = $oldTimes.started_at; period_end = $oldTimes.ends_at } $serviceKey $serviceKey).status -eq 200) 'fixture entitlement expired'
  $expired = Invoke-TrialCheck 'POST' '/rest/v1/rpc/get_plus_trial_offer' @{ p_device_hash = $device } $tokens[0]
  Assert-Trial ($expired.data.expired -and -not $expired.data.active -and -not $expired.data.eligible) 'server confirms expiry without webhook'
  $replay = Invoke-TrialCheck 'POST' '/rest/v1/rpc/claim_plus_trial' @{ p_client_id = [guid]::NewGuid().ToString(); p_device_hash = $device } $tokens[0]
  Assert-Trial (-not $replay.data.active -and $replay.data.ends_at -eq $expired.data.ends_at) 'new request cannot extend expired trial'
  $settings = Invoke-TrialCheck 'POST' '/rest/v1/fasting_settings' @{ user_id = $fixtureIds[0]; enabled = $true } $tokens[0]
  Assert-Trial ($settings.status -eq 400 -and $settings.data.message -eq 'PLUS_REQUIRED') 'expired Plus activity denied'
  foreach ($token in $tokens) {
    $rooms = Invoke-TrialCheck 'POST' '/rest/v1/rpc/get_my_rooms' @{} $token
    Assert-Trial ($rooms.status -eq 200 -and @($rooms.data | Where-Object { $_.id -eq $roomId }).Count -eq 1) 'Free pair remains available'
  }
  Write-Output 'Hosted cardless trial passed: no-country activation, exact seven days, safe retry, device limit, no checkout, private claims, expiry, denied Plus activity and Free pair access.'
} finally {
  if ($createdRoom) { Assert-Trial ((Invoke-TrialCheck 'DELETE' ('/rest/v1/rooms?id=eq.' + $roomId) $null $serviceKey $serviceKey).status -eq 200) 'fixture squad cleanup' }
  foreach ($fixtureId in $fixtureIds) { Assert-Trial ((Invoke-TrialCheck 'DELETE' ('/auth/v1/admin/users/' + $fixtureId) $null $serviceKey $serviceKey).status -eq 200) 'fixture account cleanup' }
  Write-Output 'Hosted cardless trial fixtures cleaned up.'
}
