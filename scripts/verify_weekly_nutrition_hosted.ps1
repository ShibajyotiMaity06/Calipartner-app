$ErrorActionPreference = 'Stop'
if (-not ('CaliSupabaseCredential' -as [type])) { Add-Type -Path (Join-Path $env:LOCALAPPDATA 'CaliPartner/SupabaseCredential.cs') }
$project = [IO.File]::ReadAllText((Join-Path $PSScriptRoot '../supabase/.temp/project-ref')).Trim()
$management = @{ Authorization = 'Bearer ' + [CaliSupabaseCredential]::Read() }
$keys = Invoke-RestMethod -Uri ('https://api.supabase.com/v1/projects/' + $project + '/api-keys') -Headers $management
$serviceKey = ($keys | Where-Object { $_.name -eq 'service_role' } | Select-Object -First 1).api_key
$anonKey = ($keys | Where-Object { $_.name -eq 'anon' } | Select-Object -First 1).api_key
$base = 'https://' + $project + '.supabase.co'
function Invoke-PlanCheck([string]$Method, [string]$Path, $Body, [string]$Token, [string]$Key = $anonKey, [int]$Timeout = 45) {
 $options = @{ Method=$Method; Uri=$base+$Path; Headers=@{apikey=$Key;Authorization='Bearer '+$Token}; ContentType='application/json'; TimeoutSec=$Timeout }
 if ($Path -eq '/rest/v1/profiles') { $options.Headers.Prefer='resolution=merge-duplicates' }
 if ($null -ne $Body) { $options.Body=ConvertTo-Json -InputObject $Body -Depth 15 -Compress }
 try { Invoke-RestMethod @options } catch { throw ('Hosted plan request failed: '+$Path) }
}
function Assert-PlanCheck([bool]$Condition, [string]$Message) { if (-not $Condition) { throw ('Hosted plan check failed: '+$Message) } }
$fixture = $null
try {
 $suffix=[guid]::NewGuid().ToString('N').Substring(0,10)
 $email='weeklyquality_'+$suffix+'@example.invalid'; $password=[guid]::NewGuid().ToString('N')+'aA8!'
 $account=Invoke-PlanCheck 'POST' '/auth/v1/admin/users' @{email=$email;password=$password;email_confirm=$true;user_metadata=@{fixture='weekly-nutrition-check'}} $serviceKey $serviceKey
 $fixture=$account.id
 Assert-PlanCheck ([bool]$fixture) 'synthetic user created'
 $null=Invoke-PlanCheck 'POST' '/rest/v1/profiles' @{id=$fixture;username=('weekly_'+$suffix);nickname='Weekly quality check';date_of_birth='1995-01-01';sex='male';height_cm=175;timezone='UTC';discoverable=$false} $serviceKey $serviceKey
 $session=Invoke-PlanCheck 'POST' '/auth/v1/token?grant_type=password' @{email=$email;password=$password} $anonKey $anonKey
 $token=$session.access_token
 $null=Invoke-PlanCheck 'POST' '/rest/v1/goal_profiles' @{id=[guid]::NewGuid().ToString();user_id=$fixture;goal='maintain';activity_level='moderate';current_weight_kg=70;weekly_rate_kg=0;daily_calorie_target=2100;protein_grams=120;carb_grams=270;fat_grams=60;bmr=1700;tdee=2100;effective_from=[DateTime]::UtcNow.ToString('o')} $serviceKey $serviceKey
 $null=Invoke-PlanCheck 'POST' '/rest/v1/health_screening' @{user_id=$fixture;pregnant_or_breastfeeding=$false;has_diabetes_or_medication=$false;has_eating_disorder_history=$false} $serviceKey $serviceKey
 $null=Invoke-PlanCheck 'POST' '/rest/v1/rpc/accept_ai_processing_consent' @{p_version='1.1-weekly-plan'} $token
 $preferences=@{workout_days=@(0,2,4);location='home';equipment=@('bodyweight');experience='beginner';session_minutes=30;limitations='';country='India';cuisine='Indian';diet='mixed';allergies=@();exclusions=@();meals_per_day=4;cooking_minutes=30;budget='economical'}
 $request=@{request_id=[guid]::NewGuid().ToString();preferences=$preferences}
 Write-Output 'Generating one real-provider weekly plan for a private synthetic account.'
 $built=Invoke-PlanCheck 'POST' '/functions/v1/weekly-plan' $request $token $anonKey 180
 Assert-PlanCheck ($built.saved -eq $true) 'generation acknowledged'
 $saved=@(Invoke-PlanCheck 'GET' ('/rest/v1/personal_weekly_plans?user_id=eq.'+$fixture+'&select=id,revision,content') $null $serviceKey $serviceKey)
 Assert-PlanCheck ($saved.Count -eq 1 -and $saved[0].content.days.Count -eq 7) 'full week stored privately'
 foreach ($day in $saved[0].content.days) {
  Assert-PlanCheck ($day.meals.Count -eq 4) 'four actual meals per day'
  $signatures=@($day.meals|ForEach-Object { '{0}|{1}|{2}|{3}' -f $_.calories,$_.protein,$_.carbs,$_.fat }|Select-Object -Unique)
  Assert-PlanCheck ($signatures.Count -gt 1) 'day has independently estimated meal totals'
  $total=($day.meals|Measure-Object calories -Sum).Sum
  Assert-PlanCheck ($total -ge 1890 -and $total -le 2415) 'saved daily calorie constraints retained'
 }
 $retry=Invoke-PlanCheck 'POST' '/functions/v1/weekly-plan' $request $token
 Assert-PlanCheck ($retry.saved -eq $true) 'identical retry acknowledged'
 $again=@(Invoke-PlanCheck 'GET' ('/rest/v1/personal_weekly_plans?user_id=eq.'+$fixture+'&select=id,revision') $null $serviceKey $serviceKey)
 Assert-PlanCheck ($again[0].revision -eq $saved[0].revision) 'retry does not replace the saved plan'
 $preview=Invoke-PlanCheck 'POST' '/rest/v1/rpc/get_personal_weekly_plan' @{} $token
 Assert-PlanCheck ($preview.days.Count -eq 1 -and $preview.days[0].day -eq 0 -and -not $preview.full_access) 'Free receives Monday only'
 Write-Output 'Hosted weekly nutrition passed: 28 real-provider meals with distinct meal nutrition on all seven days, unchanged daily constraints, acknowledged idempotent retry and Monday-only Free projection.'
} finally {
 if ($fixture) { $null=Invoke-PlanCheck 'DELETE' ('/auth/v1/admin/users/'+$fixture) $null $serviceKey $serviceKey; Write-Output 'Hosted weekly nutrition fixture cleanup completed.' }
}
