param([switch]$CheckWeeklyPlan)
$ErrorActionPreference = 'Stop'
$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (-not ('CaliSupabaseCredential' -as [type])) { Add-Type -Path (Join-Path $env:LOCALAPPDATA 'CaliPartner/SupabaseCredential.cs') }
$projectReference = [IO.File]::ReadAllText((Join-Path $repositoryRoot 'supabase/.temp/project-ref')).Trim()
$managementHeaders = @{ Authorization = 'Bearer ' + [CaliSupabaseCredential]::Read() }
$apiKeys = Invoke-RestMethod -Uri ('https://api.supabase.com/v1/projects/' + $projectReference + '/api-keys') -Headers $managementHeaders
$serviceKey = ($apiKeys | Where-Object { $_.name -eq 'service_role' } | Select-Object -First 1).api_key
$anonKey = ($apiKeys | Where-Object { $_.name -eq 'anon' } | Select-Object -First 1).api_key
if (-not $serviceKey -or -not $anonKey) { throw 'Hosted verification requires project API keys.' }
$apiRoot = 'https://' + $projectReference + '.supabase.co'
function Invoke-Hosted([string]$Method, [string]$Path, $Body, [string]$Token, [string]$Key = $anonKey, [int]$TimeoutSeconds = 60) {
  $request = @{ Method = $Method; Uri = $apiRoot + $Path; Headers = @{ apikey = $Key; Authorization = 'Bearer ' + $Token }; ContentType = 'application/json'; TimeoutSec = $TimeoutSeconds }
  if ($Path -in @('/rest/v1/profiles', '/rest/v1/entitlements', '/rest/v1/health_screening')) { $request.Headers.Prefer = 'resolution=merge-duplicates' }
  if ($null -ne $Body) { $request.Body = ConvertTo-Json -InputObject $Body -Depth 12 -Compress }
  Invoke-RestMethod @request
}
function Invoke-TestRpc([string]$Name, $Body, [string]$Token) { Invoke-Hosted 'POST' ('/rest/v1/rpc/' + $Name) $Body $Token }
function Assert-Check([bool]$Passed, [string]$Description) { if (-not $Passed) { throw ('Hosted check failed: ' + $Description) } }
$fixtureUsers = @()
$tokens = @()
$names = @()
$roomId = [guid]::NewGuid().ToString()
$createdRoom = $false
try {
  for ($index = 0; $index -lt 2; $index++) {
    $suffix = [guid]::NewGuid().ToString('N').Substring(0, 8)
    $nickname = 'chatcheck_' + $suffix
    $password = [guid]::NewGuid().ToString('N') + 'aA8!'
    $email = $nickname + '@example.invalid'
    $account = Invoke-Hosted 'POST' '/auth/v1/admin/users' @{ email = $email; password = $password; email_confirm = $true; user_metadata = @{ fixture = 'free-chat-deploy-check' } } $serviceKey $serviceKey
    $fixtureUsers += $account.id
    $names += $nickname
    $profile = @{ id = $account.id; username = $nickname; nickname = 'Chat check'; date_of_birth = '1995-01-01'; sex = 'male'; height_cm = 175; timezone = 'UTC'; discoverable = $false }
    $null = Invoke-Hosted 'POST' '/rest/v1/profiles' $profile $serviceKey $serviceKey
    $session = Invoke-Hosted 'POST' '/auth/v1/token?grant_type=password' @{ email = $email; password = $password } $anonKey $anonKey
    $tokens += $session.access_token
  }
  $room = Invoke-TestRpc 'create_room_v3' @{ p_client_id = $roomId; p_name = 'Chat access verification' } $tokens[0]
  $createdRoom = $true
  $null = Invoke-TestRpc 'join_by_code' @{ p_code = $room.code } $tokens[1]
  foreach ($token in $tokens) { $null = Invoke-TestRpc 'accept_chat_terms' @{} $token }
  $requestId = [guid]::NewGuid().ToString()
  $message = Invoke-TestRpc 'send_chat_message' @{ p_room_id = $roomId; p_client_id = $requestId; p_text = '@' + $names[1] + ' Free chat deployment check' } $tokens[0]
  $replay = Invoke-TestRpc 'send_chat_message' @{ p_room_id = $roomId; p_client_id = $requestId; p_text = 'retry' } $tokens[0]
  Assert-Check ($message.id -eq $replay.id) 'send idempotency'
  $messages = @(Invoke-TestRpc 'get_chat_messages_v2' @{ p_room_id = $roomId } $tokens[1])
  Assert-Check ($messages.id -contains $message.id) 'Free member receives chat'
  $mentions = Invoke-TestRpc 'get_squad_mentions' @{ p_room_id = $roomId } $tokens[1]
  Assert-Check (-not $mentions.locked -and $mentions.count -eq 1) 'Free mention projection'
  $null = Invoke-TestRpc 'mark_squad_mention_seen' @{ p_room_id = $roomId; p_message_id = $message.id } $tokens[1]
  $null = Invoke-TestRpc 'set_chat_typing' @{ p_room_id = $roomId; p_is_typing = $true } $tokens[0]
  $typing = @(Invoke-TestRpc 'get_chat_typing' @{ p_room_id = $roomId } $tokens[1])
  Assert-Check ($typing.user_id -contains $fixtureUsers[0]) 'Free typing'
  $null = Invoke-TestRpc 'mark_chat_read' @{ p_room_id = $roomId; p_message_id = $message.id } $tokens[1]
  Assert-Check ((Invoke-TestRpc 'get_chat_unread_count' @{ p_room_id = $roomId } $tokens[1]) -eq 0) 'Free read acknowledgement'
  $reply = Invoke-TestRpc 'send_chat_message' @{ p_room_id = $roomId; p_client_id = [guid]::NewGuid().ToString(); p_text = 'Free member reply' } $tokens[1]
  Assert-Check ([bool]$reply.id) 'Free reply'
  $denied = $false
  try { $null = Invoke-Hosted 'POST' '/functions/v1/ai-coach' @{ messages = @(@{ role = 'user'; content = 'Hello' }) } $tokens[1] } catch { $denied = [int]$_.Exception.Response.StatusCode -eq 403 }
  Assert-Check $denied 'AI remains gated for Free'
  Write-Output 'Hosted verification passed: two Free fixture members create/join, send/retry/read, receive mentions, type, acknowledge and reply; AI remains gated.'
  $catalog = Get-Content (Join-Path $repositoryRoot 'app/assets/bundled_foods.json') -Raw | ConvertFrom-Json
  $foods = @(
    ($catalog | Where-Object { $_.name -eq 'Chicken breast, roasted, skinless (grilled chicken breast)' } | Select-Object -First 1),
    ($catalog | Where-Object { $_.name -eq 'Chicken Eggs' } | Select-Object -First 1)
  )
  $fixtureDate = [DateTime]::UtcNow.ToString('yyyy-MM-dd')
  foreach ($food in $foods) {
    Assert-Check ([bool]$food.id) 'regression food exists'
    $foodEntryId = [guid]::NewGuid().ToString()
    $entry = @{ id = $foodEntryId; user_id = $fixtureUsers[1]; food_id = $food.id; food_name = $food.name; meal_section = 'lunch'; quantity = 100; unit = 'g'; calories = $food.calories_per_100g; protein = $food.protein_per_100g; carbs = $food.carbs_per_100g; fat = $food.fat_per_100g; local_date = $fixtureDate; source = 'search' }
    $changes = @(
      @{ id = $foodEntryId; entity = 'food_entries'; operation = 'upsert'; payload = $entry },
      @{ id = [guid]::NewGuid().ToString(); entity = 'user_food_stats'; operation = 'upsert'; payload = @{ user_id = $fixtureUsers[1]; food_id = $food.id; use_count = 1; last_quantity = 100; last_unit = 'g'; last_meal_section = 'lunch'; last_used_at = [DateTime]::UtcNow.ToString('o') } }
    )
    $null = Invoke-TestRpc 'save_tracking_changes' @{ p_changes = $changes } $tokens[1]
    $null = Invoke-TestRpc 'save_tracking_changes' @{ p_changes = $changes } $tokens[1]
  }
  $summary = @(Invoke-Hosted 'GET' ('/rest/v1/daily_summaries?user_id=eq.' + $fixtureUsers[1] + '&local_date=eq.' + $fixtureDate + '&select=calories,protein') $null $tokens[1])
  Assert-Check ($summary.Count -eq 1 -and $summary[0].calories -eq 293 -and $summary[0].protein -eq 44.32) 'chicken and egg calories persist without duplicate retry totals'
  Write-Output 'Hosted food regression passed: chicken breast and chicken eggs save and retry; summary is 293 kcal and 44.32 g protein.'
  if ($CheckWeeklyPlan) {
    $goal = @{ id = [guid]::NewGuid().ToString(); user_id = $fixtureUsers[0]; goal = 'maintain'; activity_level = 'moderate'; current_weight_kg = 70; weekly_rate_kg = 0; daily_calorie_target = 2100; protein_grams = 120; carb_grams = 270; fat_grams = 60; bmr = 1700; tdee = 2100; effective_from = [DateTime]::UtcNow.ToString('o') }
    $null = Invoke-Hosted 'POST' '/rest/v1/goal_profiles' $goal $serviceKey $serviceKey
    $null = Invoke-Hosted 'POST' '/rest/v1/health_screening' @{ user_id = $fixtureUsers[0]; pregnant_or_breastfeeding = $false; has_diabetes_or_medication = $false; has_eating_disorder_history = $false } $serviceKey $serviceKey
    $null = Invoke-TestRpc 'accept_ai_processing_consent' @{ p_version = '1.1-weekly-plan' } $tokens[0]
    $preferences = @{ workout_days = @(0, 2, 4); location = 'home'; equipment = @('bodyweight'); experience = 'beginner'; session_minutes = 30; limitations = ''; country = 'India'; cuisine = 'Indian'; diet = 'mixed'; allergies = @(); exclusions = @(); meals_per_day = 3; cooking_minutes = 30; budget = 'economical' }
    Write-Output 'Building one live weekly plan using synthetic fixture goals and preferences.'
    $built = Invoke-Hosted 'POST' '/functions/v1/weekly-plan' @{ request_id = [guid]::NewGuid().ToString(); preferences = $preferences } $tokens[0] $anonKey 280
    Assert-Check $built.saved 'live weekly generation acknowledged'
    $preview = Invoke-TestRpc 'get_personal_weekly_plan' @{} $tokens[0]
    Assert-Check ($preview.days.Count -eq 1 -and $preview.days[0].day -eq 0 -and $preview.workout_tips.Count -eq 0 -and $preview.diet_tips.Count -eq 0) 'Free Monday projection'
    $entitlement = @{ user_id = $fixtureUsers[0]; tier = 'plus'; status = 'trial'; source = 'apple'; period_end = [DateTime]::UtcNow.AddDays(7).ToString('o') }
    $null = Invoke-Hosted 'POST' '/rest/v1/entitlements' $entitlement $serviceKey $serviceKey
    Assert-Check ((Invoke-TestRpc 'get_personal_weekly_plan' @{} $tokens[0]).days.Count -eq 1) 'trial excludes full week'
    $null = Invoke-Hosted 'PATCH' ('/rest/v1/entitlements?user_id=eq.' + $fixtureUsers[0]) @{ status = 'paid' } $serviceKey $serviceKey
    $full = Invoke-TestRpc 'get_personal_weekly_plan' @{} $tokens[0]
    Assert-Check ($full.days.Count -eq 7 -and $full.workout_tips.Count -gt 0 -and $full.diet_tips.Count -gt 0) 'paid fixture full week and personal tips'
    Write-Output 'Hosted live weekly plan passed: real provider generation, Monday-only Free/trial and full paid fixture projection.'
  }
} finally {
  if ($createdRoom) { $null = Invoke-Hosted 'DELETE' ('/rest/v1/rooms?id=eq.' + $roomId) $null $serviceKey $serviceKey }
  foreach ($fixtureId in $fixtureUsers) { $null = Invoke-Hosted 'DELETE' ('/auth/v1/admin/users/' + $fixtureId) $null $serviceKey $serviceKey }
  Write-Output 'Hosted chat fixture cleanup completed.'
}
