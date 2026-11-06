$ErrorActionPreference = 'Stop'
if (-not ('CaliSupabaseCredential' -as [type])) { Add-Type -Path (Join-Path $env:LOCALAPPDATA 'CaliPartner/SupabaseCredential.cs') }
$habitRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$habitProject = [IO.File]::ReadAllText((Join-Path $habitRoot 'supabase/.temp/project-ref')).Trim()
$habitHeaders = @{ Authorization = 'Bearer ' + [CaliSupabaseCredential]::Read() }
$habitKeys = Invoke-RestMethod -Uri ('https://api.supabase.com/v1/projects/' + $habitProject + '/api-keys') -Headers $habitHeaders
$habitServiceKey = ($habitKeys | Where-Object { $_.name -eq 'service_role' } | Select-Object -First 1).api_key
$habitAnonKey = ($habitKeys | Where-Object { $_.name -eq 'anon' } | Select-Object -First 1).api_key
$habitBase = 'https://' + $habitProject + '.supabase.co'
function Invoke-HabitRequest([string]$Method, [string]$Path, $Body, [string]$Token, [string]$Key = $habitAnonKey) {
  $options = @{ Method = $Method; Uri = $habitBase + $Path; Headers = @{ apikey = $Key; Authorization = 'Bearer ' + $Token; Prefer = 'resolution=merge-duplicates,return=representation' }; ContentType = 'application/json'; TimeoutSec = 45 }
  if ($null -ne $Body) { $options.Body = ConvertTo-Json -InputObject $Body -Depth 20 -Compress }
  try { return @{ ok = $true; data = (Invoke-RestMethod @options) } }
  catch {
    if (-not $_.Exception.Response) { throw ('Hosted habit request unavailable: ' + $Path) }
    $code = ''
    if ($_.ErrorDetails.Message) { try { $code = ($_.ErrorDetails.Message | ConvertFrom-Json).message } catch { $code = '' } }
    return @{ ok = $false; code = $code }
  }
}
function Assert-Habit([bool]$Passed, [string]$Message) { if (-not $Passed) { throw ('Hosted habit check failed: ' + $Message) } }
$habitUsers = @()
$habitTokens = @()
try {
  for ($index = 0; $index -lt 2; $index++) {
    $suffix = [guid]::NewGuid().ToString('N').Substring(0, 12)
    $email = 'habitcheck_' + $suffix + '@example.invalid'
    $password = [guid]::NewGuid().ToString('N') + 'aA8!'
    $created = Invoke-HabitRequest 'POST' '/auth/v1/admin/users' @{ email = $email; password = $password; email_confirm = $true; user_metadata = @{ fixture = 'weekly-habit-check' } } $habitServiceKey $habitServiceKey
    Assert-Habit ($created.ok -and [bool]$created.data.id) 'private fixture account'
    $habitUsers += $created.data.id
    $signed = Invoke-HabitRequest 'POST' '/auth/v1/token?grant_type=password' @{ email = $email; password = $password } $habitAnonKey
    Assert-Habit ($signed.ok -and [bool]$signed.data.access_token) 'fixture sign-in'
    $habitTokens += $signed.data.access_token
    $profile = Invoke-HabitRequest 'POST' '/rest/v1/profiles' @{ id = $created.data.id; username = 'habit_' + $suffix; nickname = 'Habit fixture'; date_of_birth = '1995-01-01'; sex = 'male'; height_cm = 175; timezone = 'Pacific/Kiritimati' } $habitServiceKey $habitServiceKey
    Assert-Habit $profile.ok 'stored-zone fixture profile'
  }
  $ownerId = $habitUsers[0]; $ownerToken = $habitTokens[0]
  $planId = [guid]::NewGuid().ToString()
  $meal = @{ name = 'Breakfast oats'; ingredients = @('Oats 60 g'); portion = 'One bowl'; calories = 450; protein = 30; carbs = 60; fat = 10 }
  $option = @{ name = 'Breakfast tofu'; ingredients = @('Tofu 150 g'); portion = 'One bowl'; calories = 440; protein = 29; carbs = 55; fat = 11 }
  $meal.alternatives = @($option)
  $days = @(0..6 | ForEach-Object { @{ day = $_; workout = @{ title = 'Rest'; minutes = 0; exercises = @() }; meals = @($meal) } })
  $saved = Invoke-HabitRequest 'POST' '/rest/v1/personal_weekly_plans' @{ user_id = $ownerId; id = $planId; preferences = @{}; content = @{ days = $days; workout_tips = @(); diet_tips = @() } } $habitServiceKey $habitServiceKey
  Assert-Habit $saved.ok 'private server-owned fixture plan'
  $logId = [guid]::NewGuid().ToString()
  $log = @{ p_id = $logId; p_plan_id = $planId; p_revision = 1; p_day = 0; p_meal = 0; p_section = 'breakfast' }
  1..2 | ForEach-Object { $reply = Invoke-HabitRequest 'POST' '/rest/v1/rpc/log_weekly_plan_meal' $log $ownerToken; Assert-Habit ($reply.ok -and $reply.data -eq $logId) 'acknowledged idempotent Monday log' }
  $entries = Invoke-HabitRequest 'GET' ('/rest/v1/food_entries?id=eq.' + $logId) $null $ownerToken
  Assert-Habit ($entries.ok -and @($entries.data).Count -eq 1) 'one saved row'
  $localDay = [DateTimeOffset]::UtcNow.ToOffset([TimeSpan]::FromHours(14)).ToString('yyyy-MM-dd')
  Assert-Habit ($entries.data[0].local_date -eq $localDay) 'stored-zone diary day'
  Assert-Habit (@($entries.data[0].nutrition_details.not_provided).Count -eq 3) 'unknown micronutrients stay explicit'
  $peer = Invoke-HabitRequest 'GET' ('/rest/v1/food_entries?id=eq.' + $logId) $null $habitTokens[1]
  Assert-Habit ($peer.ok -and @($peer.data).Count -eq 0) 'other accounts cannot read the diary row'
  $ledger = Invoke-HabitRequest 'GET' '/rest/v1/weekly_meal_actions?select=id' $null $ownerToken
  Assert-Habit (-not $ledger.ok) 'request ledger denies client reads'
  $log.p_id = [guid]::NewGuid().ToString(); $log.p_day = 1
  $denied = Invoke-HabitRequest 'POST' '/rest/v1/rpc/log_weekly_plan_meal' $log $ownerToken
  Assert-Habit (-not $denied.ok -and $denied.code -match 'PURCHASED_PLUS_REQUIRED') 'Free other-day denial'
  $entitlement = Invoke-HabitRequest 'POST' '/rest/v1/entitlements' @{ user_id = $ownerId; tier = 'plus'; status = 'trial'; period_end = [DateTime]::UtcNow.AddDays(7).ToString('o') } $habitServiceKey $habitServiceKey
  Assert-Habit $entitlement.ok 'fixture trial entitlement'
  $denied = Invoke-HabitRequest 'POST' '/rest/v1/rpc/log_weekly_plan_meal' $log $ownerToken
  Assert-Habit (-not $denied.ok -and $denied.code -match 'PURCHASED_PLUS_REQUIRED') 'trial other-day denial'
  $paid = Invoke-HabitRequest 'PATCH' ('/rest/v1/entitlements?user_id=eq.' + $ownerId) @{ status = 'paid' } $habitServiceKey $habitServiceKey
  Assert-Habit $paid.ok 'fixture purchased entitlement'
  $allowed = Invoke-HabitRequest 'POST' '/rest/v1/rpc/log_weekly_plan_meal' $log $ownerToken
  Assert-Habit $allowed.ok 'purchased other-day save'
  $swap = @{ p_id = [guid]::NewGuid().ToString(); p_plan_id = $planId; p_revision = 1; p_day = 0; p_meal = 0; p_option = 0 }
  1..2 | ForEach-Object { $changed = Invoke-HabitRequest 'POST' '/rest/v1/rpc/swap_weekly_plan_meal' $swap $ownerToken; Assert-Habit ($changed.ok -and $changed.data.revision -eq 2 -and $changed.data.days[0].meals[0].name -eq 'Breakfast tofu') 'acknowledged idempotent swap' }
  $repeat = @{ p_id = [guid]::NewGuid().ToString(); p_target_date = ([DateTime]::ParseExact($localDay, 'yyyy-MM-dd', $null)).AddDays(1).ToString('yyyy-MM-dd'); p_section = 'breakfast' }
  1..2 | ForEach-Object { $copied = Invoke-HabitRequest 'POST' '/rest/v1/rpc/repeat_previous_day_meal' $repeat $ownerToken; Assert-Habit ($copied.ok -and $copied.data -eq 2) 'atomic idempotent repeat' }
  $workoutId = [guid]::NewGuid().ToString(); $exerciseId = [guid]::NewGuid().ToString(); $setId = [guid]::NewGuid().ToString()
  $workoutChanges = @{ p_changes = @(
    @{ id = $workoutId; entity = 'workouts'; operation = 'upsert'; payload = @{ id = $workoutId; user_id = $ownerId; type = 'cardio'; name = 'Cycling'; duration_minutes = 30; local_date = $localDay } },
    @{ id = $exerciseId; entity = 'workout_exercises'; operation = 'upsert'; payload = @{ id = $exerciseId; workout_id = $workoutId; user_id = $ownerId; exercise_name = 'Cycling'; order_in_workout = 1 } },
    @{ id = $setId; entity = 'workout_sets'; operation = 'upsert'; payload = @{ id = $setId; workout_id = $workoutId; workout_exercise_id = $exerciseId; user_id = $ownerId; set_number = 1; reps = 0; weight_kg = 0; duration_seconds = 1800; distance_meters = 12500; completed = $true; is_warmup = $false } }
  ) }
  1..2 | ForEach-Object { $workoutSaved = Invoke-HabitRequest 'POST' '/rest/v1/rpc/save_tracking_changes' $workoutChanges $ownerToken; Assert-Habit $workoutSaved.ok 'atomic cardio save and retry' }
  $sets = Invoke-HabitRequest 'GET' ('/rest/v1/workout_sets?workout_id=eq.' + $workoutId) $null $ownerToken
  Assert-Habit ($sets.ok -and @($sets.data).Count -eq 1 -and $sets.data[0].distance_meters -eq 12500 -and $sets.data[0].duration_seconds -eq 1800) 'one cardio set with saved distance and duration'
  Write-Output 'Hosted weekly habits: acknowledged logs, retry identity, stored-zone dates, private reads, Free/trial gates, purchased swap, atomic repeat and cardio distance passed.'
} finally {
  foreach ($fixtureId in $habitUsers) {
    $deleted = Invoke-HabitRequest 'DELETE' ('/auth/v1/admin/users/' + $fixtureId) $null $habitServiceKey $habitServiceKey
    Assert-Habit $deleted.ok 'fixture cleanup'
  }
}
