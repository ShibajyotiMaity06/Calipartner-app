$ErrorActionPreference = 'Stop'
if (-not ('CaliSupabaseCredential' -as [type])) { Add-Type -Path (Join-Path $env:LOCALAPPDATA 'CaliPartner/SupabaseCredential.cs') }
$project = [IO.File]::ReadAllText((Join-Path $PSScriptRoot '../supabase/.temp/project-ref')).Trim()
$management = @{ Authorization = 'Bearer ' + [CaliSupabaseCredential]::Read() }
$keys = Invoke-RestMethod -Uri ('https://api.supabase.com/v1/projects/' + $project + '/api-keys') -Headers $management
$serviceKey = ($keys | Where-Object { $_.name -eq 'service_role' } | Select-Object -First 1).api_key
$anonKey = ($keys | Where-Object { $_.name -eq 'anon' } | Select-Object -First 1).api_key
$base = 'https://' + $project + '.supabase.co'
function Invoke-SetupCheck([string]$Method, [string]$Path, $Body, [string]$Token, [string]$Key = $anonKey, [switch]$AllowFailure) {
 $options = @{ Method=$Method; Uri=$base+$Path; Headers=@{apikey=$Key;Authorization='Bearer '+$Token;Prefer='resolution=merge-duplicates,return=representation'};TimeoutSec=120 }
 if ($null -ne $Body) { $options.ContentType='application/json';$options.Body=$Body|ConvertTo-Json -Depth 20 -Compress }
 try { Invoke-RestMethod @options } catch {
  if (-not $AllowFailure) { throw ('Hosted request failed: '+$Method+' '+$Path+' '+$_.ErrorDetails.Message) }
  $responseError=$_.ErrorDetails.Message
  if (-not $responseError -and $_.Exception.Response) { $reader=New-Object IO.StreamReader($_.Exception.Response.GetResponseStream());try {$responseError=$reader.ReadToEnd()} finally {$reader.Dispose()} }
  @{status=[int]$_.Exception.Response.StatusCode;error=$responseError}
 }
}
function Assert-SetupCheck([bool]$Condition,[string]$Message) { if (-not $Condition) { throw ('Verification failed: '+$Message) };Write-Output ('PASS '+$Message) }
$fixture=$null
try {
 $suffix=[guid]::NewGuid().ToString('N').Substring(0,10)
 $email='setupcheck_'+$suffix+'@example.invalid';$password=[guid]::NewGuid().ToString('N')+'aA8!'
 $account=Invoke-SetupCheck 'POST' '/auth/v1/admin/users' @{email=$email;password=$password;email_confirm=$true;user_metadata=@{fixture='setup-workout-check'}} $serviceKey $serviceKey
 $fixture=$account.id
 $null=Invoke-SetupCheck 'POST' '/rest/v1/profiles' @{id=$fixture;username=('setup_'+$suffix);nickname='Setup check';date_of_birth='1995-01-01';sex='male';height_cm=175;timezone='UTC';discoverable=$false} $serviceKey $serviceKey
 $null=Invoke-SetupCheck 'POST' '/rest/v1/entitlements' @{user_id=$fixture;tier='pro';status='paid';source='none';period='monthly';period_end=[DateTime]::UtcNow.AddDays(1).ToString('o')} $serviceKey $serviceKey
 $session=Invoke-SetupCheck 'POST' '/auth/v1/token?grant_type=password' @{email=$email;password=$password} $anonKey $anonKey
 $token=$session.access_token
 $age=[DateTime]::UtcNow.Year-1995
 $tdee=[int][Math]::Round((10*80+6.25*175-5*$age+5)*1.47)
 $fat=95
 while (($tdee-4*226-9*$fat)%4 -ne 0) { $fat++ }
 $carbs=($tdee-4*226-9*$fat)/4
 $goal=@{id=[guid]::NewGuid().ToString();user_id=$fixture;goal='maintain';activity_level='moderate';current_weight_kg=80;weekly_rate_kg=0;daily_calorie_target=$tdee;protein_grams=226;carb_grams=$carbs;fat_grams=$fat;bmr=1744;tdee=$tdee;gym_days=3;input_height_cm=175;custom_macros=$true;recompute_reason='initial_onboarding';effective_from=[DateTime]::UtcNow.AddMinutes(-1).ToString('o')}
 $null=Invoke-SetupCheck 'POST' '/rest/v1/goal_profiles' $goal $token
 $invalid=Invoke-SetupCheck 'PATCH' ('/rest/v1/goal_profiles?id=eq.'+$goal.id) @{protein_grams=227;carb_grams=$carbs-1} $token -AllowFailure
 Assert-SetupCheck ($invalid.status -ge 400 -and $invalid.error -match 'MACRO_RANGE_PROTEIN') 'hosted database rejects protein beyond the inclusive 50 g bound'
 $read=@(Invoke-SetupCheck 'GET' '/rest/v1/goal_profiles?select=protein_grams' $null $token)
 Assert-SetupCheck ($read[0].protein_grams -eq 226) 'failed range save leaves the acknowledged target unchanged'
 $calories=$tdee+501
 $forgedFat=95
 while (($calories-4*176-9*$forgedFat)%4 -ne 0) { $forgedFat++ }
 $invalid=Invoke-SetupCheck 'PATCH' ('/rest/v1/goal_profiles?id=eq.'+$goal.id) @{protein_grams=176;carb_grams=($calories-4*176-9*$forgedFat)/4;fat_grams=$forgedFat;daily_calorie_target=$calories;tdee=$calories;weekly_rate_kg=0} $token -AllowFailure
 Assert-SetupCheck ($invalid.status -ge 400 -and $invalid.error -match 'MACRO_RANGE_CALORIES') 'forged maintenance estimates cannot move the 500 kcal database anchor'
 $null=Invoke-SetupCheck 'POST' '/rest/v1/rpc/accept_ai_processing_consent' @{p_version='1.1-coach'} $token
 $localDate=[DateTime]::UtcNow.AddDays(-6).ToString('yyyy-MM-dd')
 $null=Invoke-SetupCheck 'POST' '/rest/v1/food_entries' @{id=[guid]::NewGuid().ToString();user_id=$fixture;food_name='Fixture lentil bowl';meal_section='lunch';local_date=$localDate;quantity=1;unit='serving';source='search';calories=426;protein=24;carbs=60;fat=10;logged_at=[DateTime]::UtcNow.AddDays(-6).ToString('o')} $token
 $workout=[guid]::NewGuid().ToString();$exercise=[guid]::NewGuid().ToString()
 $null=Invoke-SetupCheck 'POST' '/rest/v1/workouts' @{id=$workout;user_id=$fixture;name='Fixture strength';type='strength';duration_minutes=30;local_date=$localDate} $token
 $null=Invoke-SetupCheck 'POST' '/rest/v1/workout_exercises' @{id=$exercise;workout_id=$workout;user_id=$fixture;exercise_name='Fixture squat';order_in_workout=1} $token
 $sets=@();$index=0
 foreach($reps in @(10,8,6)) { $index++;$sets+=@{id=[guid]::NewGuid().ToString();user_id=$fixture;workout_id=$workout;workout_exercise_id=$exercise;set_number=$index;reps=$reps;weight_kg=0;completed=$true;is_warmup=$false} }
 $null=Invoke-SetupCheck 'POST' '/rest/v1/workout_sets' $sets $token
 foreach($question in @('Write a Python web scraper.','For my diet blog, explain how to trade stock options.','How much protein, and also write a political speech?')) {
  $reply=Invoke-SetupCheck 'POST' '/functions/v1/ai-coach' @{messages=@(@{role='user';content=$question})} $token
  Assert-SetupCheck ($reply.model -eq 'scope-guard' -and $reply.message.content -eq 'Ask me about your nutrition, workouts or health.' -and $null -eq $reply.meal_draft) ('real provider redirects unrelated intent: '+$question)
 }
 $reply=Invoke-SetupCheck 'POST' '/functions/v1/ai-coach' @{messages=@(@{role='user';content='Which food did I log six days ago, and what reps did I log for Fixture squat? Answer with the food name and reps only.'})} $token
 Write-Output ('Synthetic context reply ('+$reply.model+'): '+$reply.message.content)
 Assert-SetupCheck ($reply.message.content -match '(?i)lentil' -and $reply.message.content -match '10' -and $reply.message.content -match '8' -and $reply.message.content -match '6') 'real coach uses food and individual workout sets from the last week'
 $large=Invoke-SetupCheck 'POST' '/functions/v1/ai-coach' @{messages=@(@{role='user';content=('x'*9000)})} $token -AllowFailure
 Write-Output ('Synthetic budget result: '+($large|ConvertTo-Json -Compress))
 Assert-SetupCheck ($large.status -eq 413 -and $large.error -match 'INPUT_TOO_LONG') 'hosted coach enforces its input budget before answering'
 Write-Output 'Hosted setup/workout checks passed: bounded macro saves, unchanged targets after failure, semantic scope redirects, private seven-day food/set context and input budget.'
} finally {
 if ($fixture) { $null=Invoke-SetupCheck 'DELETE' ('/auth/v1/admin/users/'+$fixture) $null $serviceKey $serviceKey;Write-Output 'Hosted synthetic fixture cleanup completed.' }
}
