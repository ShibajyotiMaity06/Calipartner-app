$ErrorActionPreference = 'Stop'
if (-not ('CaliSupabaseCredential' -as [type])) { Add-Type -Path (Join-Path $env:LOCALAPPDATA 'CaliPartner/SupabaseCredential.cs') }
$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$projectRef = [IO.File]::ReadAllText((Join-Path $repositoryRoot 'supabase/.temp/project-ref')).Trim()
$managementHeaders = @{ Authorization = 'Bearer ' + [CaliSupabaseCredential]::Read() }
$keys = Invoke-RestMethod -Uri ('https://api.supabase.com/v1/projects/' + $projectRef + '/api-keys') -Headers $managementHeaders
$serviceKey = ($keys | Where-Object { $_.name -eq 'service_role' } | Select-Object -First 1).api_key
$anonKey = ($keys | Where-Object { $_.name -eq 'anon' } | Select-Object -First 1).api_key
$apiRoot = 'https://' + $projectRef + '.supabase.co'
function Invoke-RenameCheck([string]$Method, [string]$Path, $Body, [string]$Token, [string]$Key = $anonKey) {
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
function Assert-Rename([bool]$Passed, [string]$Description) { if (-not $Passed) { throw ('Hosted squad rename check failed: ' + $Description) } }
$fixtureIds = @()
$tokens = @()
$roomId = [guid]::NewGuid().ToString()
$createdRoom = $false
try {
  for ($index = 0; $index -lt 2; $index++) {
    $suffix = [guid]::NewGuid().ToString('N').Substring(0, 10)
    $email = 'renamecheck_' + $suffix + '@example.invalid'
    $password = [guid]::NewGuid().ToString('N') + 'aA8!'
    $created = Invoke-RenameCheck 'POST' '/auth/v1/admin/users' @{ email = $email; password = $password; email_confirm = $true; user_metadata = @{ fixture = 'squad-rename-check' } } $serviceKey $serviceKey
    Assert-Rename ($created.status -eq 200 -and [bool]$created.data.id) 'fixture created'
    $fixtureIds += $created.data.id
    $profile = @{ id = $created.data.id; username = 'rename_' + $suffix; nickname = 'Rename check'; date_of_birth = '1995-01-01'; sex = 'male'; height_cm = 175; timezone = 'UTC'; discoverable = $false }
    Assert-Rename ((Invoke-RenameCheck 'POST' '/rest/v1/profiles' $profile $serviceKey $serviceKey).status -eq 200) 'fixture profile saved'
    $session = Invoke-RenameCheck 'POST' '/auth/v1/token?grant_type=password' @{ email = $email; password = $password } $anonKey $anonKey
    Assert-Rename ([bool]$session.data.access_token) 'fixture authenticated'
    $tokens += $session.data.access_token
  }
  $room = Invoke-RenameCheck 'POST' '/rest/v1/rpc/create_room_v3' @{ p_client_id = $roomId; p_name = 'Rename fixture' } $tokens[0]
  Assert-Rename ($room.status -eq 200 -and $room.data.room_id -eq $roomId) 'fixture squad created'
  $createdRoom = $true
  Assert-Rename ((Invoke-RenameCheck 'POST' '/rest/v1/rpc/join_by_code' @{ p_code = $room.data.code } $tokens[1]).status -eq 200) 'member joined'
  $payload = @{ p_client_id = [guid]::NewGuid().ToString(); p_room_id = $roomId; p_name = '  Renamed squad  ' }
  $denied = Invoke-RenameCheck 'POST' '/rest/v1/rpc/rename_room' $payload $tokens[1]
  Assert-Rename ($denied.status -eq 400 -and $denied.data.message -eq 'NOT_AUTHORIZED') 'member rename denied by SQL'
  $renamed = Invoke-RenameCheck 'POST' '/rest/v1/rpc/rename_room' $payload $tokens[0]
  Assert-Rename ($renamed.status -eq 200 -and $renamed.data.name -eq 'Renamed squad' -and $renamed.data.request_id -eq $payload.p_client_id) 'Free host acknowledged rename'
  $newPayload = @{ p_client_id = [guid]::NewGuid().ToString(); p_room_id = $roomId; p_name = 'Latest squad name' }
  Assert-Rename ((Invoke-RenameCheck 'POST' '/rest/v1/rpc/rename_room' $newPayload $tokens[0]).status -eq 200) 'second rename acknowledged'
  $replayed = Invoke-RenameCheck 'POST' '/rest/v1/rpc/rename_room' $payload $tokens[0]
  Assert-Rename ($replayed.status -eq 200 -and $replayed.data.name -eq 'Latest squad name') 'old request cannot revert a newer name'
  foreach ($token in $tokens) {
    $rooms = Invoke-RenameCheck 'POST' '/rest/v1/rpc/get_my_rooms' @{} $token
    Assert-Rename ($rooms.status -eq 200 -and @($rooms.data | Where-Object { $_.id -eq $roomId -and $_.name -eq 'Latest squad name' }).Count -eq 1) 'host and member projections agree'
  }
  Write-Output 'Hosted squad rename passed: Free host acknowledgement, SQL member denial, safe old-request replay and matching host/member projections.'
} finally {
  if ($createdRoom) { Assert-Rename ((Invoke-RenameCheck 'DELETE' ('/rest/v1/rooms?id=eq.' + $roomId) $null $serviceKey $serviceKey).status -eq 200) 'fixture squad cleanup' }
  foreach ($fixtureId in $fixtureIds) { Assert-Rename ((Invoke-RenameCheck 'DELETE' ('/auth/v1/admin/users/' + $fixtureId) $null $serviceKey $serviceKey).status -eq 200) 'fixture account cleanup' }
  Write-Output 'Hosted squad rename fixtures cleaned up.'
}
