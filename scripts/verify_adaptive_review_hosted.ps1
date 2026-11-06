$ErrorActionPreference = 'Stop'
if (-not ('CaliSupabaseCredential' -as [type])) { Add-Type -Path (Join-Path $env:LOCALAPPDATA 'CaliPartner/SupabaseCredential.cs') }
$reviewProject = [IO.File]::ReadAllText((Join-Path $PSScriptRoot '../supabase/.temp/project-ref')).Trim()
$reviewManagement = @{ Authorization = 'Bearer ' + [CaliSupabaseCredential]::Read() }
$reviewKeys = Invoke-RestMethod -Uri ('https://api.supabase.com/v1/projects/' + $reviewProject + '/api-keys') -Headers $reviewManagement
$reviewServiceKey = ($reviewKeys | Where-Object { $_.name -eq 'service_role' } | Select-Object -First 1).api_key
$reviewAnonKey = ($reviewKeys | Where-Object { $_.name -eq 'anon' } | Select-Object -First 1).api_key
$reviewBase = 'https://' + $reviewProject + '.supabase.co'
function Invoke-ReviewCheck([string]$Method,[string]$Path,$Body,[string]$Token,[string]$Key=$reviewAnonKey,[int]$ExpectedStatus=200) {
 $options=@{Method=$Method;Uri=$reviewBase+$Path;Headers=@{apikey=$Key;Authorization='Bearer '+$Token};ContentType='application/json';TimeoutSec=45}
 if($Path -eq '/rest/v1/profiles'){$options.Headers.Prefer='resolution=merge-duplicates'}
 if($null -ne $Body){$options.Body=ConvertTo-Json -InputObject $Body -Depth 15 -Compress}
 try {$result=Invoke-RestMethod @options} catch {
  $status=0;try{$status=[int]$_.Exception.Response.StatusCode}catch{}
  if($status -eq $ExpectedStatus -and $ExpectedStatus -ne 200){return @{rejected=$true}}
  throw ('Hosted review request failed: '+$Path+' (HTTP '+$status+')')
 }
 if($ExpectedStatus -ne 200){throw 'Expected review access rejection was not enforced.'}
 return $result
}
function Assert-ReviewCheck([bool]$Condition,[string]$Message){if(-not $Condition){throw ('Hosted review check failed: '+$Message)}}
$reviewFixture=$null
try {
 $suffix=[guid]::NewGuid().ToString('N').Substring(0,10)
 $email='adaptive_'+$suffix+'@example.invalid';$password=[guid]::NewGuid().ToString('N')+'aA8!'
 $account=Invoke-ReviewCheck 'POST' '/auth/v1/admin/users' @{email=$email;password=$password;email_confirm=$true;user_metadata=@{fixture='adaptive-review-check'}} $reviewServiceKey $reviewServiceKey
 $reviewFixture=$account.id
 Assert-ReviewCheck ([bool]$reviewFixture) 'private synthetic account created'
 $null=Invoke-ReviewCheck 'POST' '/rest/v1/profiles' @{id=$reviewFixture;username=('adaptive_'+$suffix);nickname='Adaptive review check';date_of_birth='1995-01-01';sex='male';height_cm=180;timezone='UTC';discoverable=$false} $reviewServiceKey $reviewServiceKey
 $session=Invoke-ReviewCheck 'POST' '/auth/v1/token?grant_type=password' @{email=$email;password=$password} $reviewAnonKey $reviewAnonKey
 $reviewToken=$session.access_token
 $old=[DateTime]::UtcNow.AddDays(-40).ToString('o')
 $null=Invoke-ReviewCheck 'POST' '/rest/v1/goal_profiles' @{id=[guid]::NewGuid().ToString();user_id=$reviewFixture;goal='cut';activity_level='moderate';current_weight_kg=80;weekly_rate_kg=0.5;daily_calorie_target=1950;protein_grams=176;carb_grams=96;fat_grams=96;bmr=1800;tdee=2500;gym_days=3;input_height_cm=180;effective_from=$old;confirmed_at=$old} $reviewServiceKey $reviewServiceKey
 $null=Invoke-ReviewCheck 'POST' '/rest/v1/health_screening' @{user_id=$reviewFixture;pregnant_or_breastfeeding=$false;has_diabetes_or_medication=$false;has_eating_disorder_history=$false} $reviewServiceKey $reviewServiceKey
 $null=Invoke-ReviewCheck 'POST' '/functions/v1/adaptive-review' @{request_id=[guid]::NewGuid().ToString()} $reviewToken $reviewAnonKey 403
 $null=Invoke-ReviewCheck 'POST' '/rest/v1/entitlements' @{user_id=$reviewFixture;tier='pro';status='paid';period_end=[DateTime]::UtcNow.AddDays(1).ToString('o')} $reviewServiceKey $reviewServiceKey
 $incomplete=Invoke-ReviewCheck 'POST' '/functions/v1/adaptive-review' @{request_id=[guid]::NewGuid().ToString()} $reviewToken
 Assert-ReviewCheck ($incomplete.reason -eq 'need_data') 'incomplete logs produce no proposal'
 $foods=@();$weights=@()
 for($day=1;$day -le 14;$day++){
  $date=[DateTime]::UtcNow.AddDays(-$day).ToString('yyyy-MM-dd')
  foreach($meal in @('lunch','dinner')){$foods+=@{id=[guid]::NewGuid().ToString();user_id=$reviewFixture;food_name='Synthetic review fixture';meal_section=$meal;quantity=1;unit='serving';calories=1000;protein=50;carbs=125;fat=30;local_date=$date;source='search'}}
  if($day -in @(1,6,11,14)){$weights+=@{id=[guid]::NewGuid().ToString();user_id=$reviewFixture;weight_kg=$(if($day -gt 7){80.5}else{80});local_date=$date}}
 }
 $null=Invoke-ReviewCheck 'POST' '/rest/v1/food_entries' $foods $reviewServiceKey $reviewServiceKey
 $null=Invoke-ReviewCheck 'POST' '/rest/v1/weight_logs' $weights $reviewServiceKey $reviewServiceKey
 $ready=Invoke-ReviewCheck 'POST' '/functions/v1/adaptive-review' @{request_id=[guid]::NewGuid().ToString()} $reviewToken
 Assert-ReviewCheck ($ready.reason -eq 'ready' -and $ready.proposal.logged_days -eq 14 -and $ready.proposal.weigh_in_days -eq 4) 'verified owner evidence generates a real proposal'
 $before=@(Invoke-ReviewCheck 'GET' ('/rest/v1/goal_profiles?user_id=eq.'+$reviewFixture+'&select=id') $null $reviewToken)
 Assert-ReviewCheck ($before.Count -eq 1) 'preview does not change targets'
 $saved=Invoke-ReviewCheck 'POST' '/rest/v1/rpc/accept_adaptive_review' @{p_id=$ready.id} $reviewToken
 Assert-ReviewCheck ($saved.id -eq $ready.id -and $saved.recompute_reason -eq 'recalibration' -and $saved.daily_calorie_target -ge 1500) 'acceptance confirms safe targets'
 $retry=Invoke-ReviewCheck 'POST' '/rest/v1/rpc/accept_adaptive_review' @{p_id=$ready.id} $reviewToken
 Assert-ReviewCheck ($retry.id -eq $saved.id) 'acceptance retry returns the same target history row'
 $after=@(Invoke-ReviewCheck 'GET' ('/rest/v1/goal_profiles?user_id=eq.'+$reviewFixture+'&select=id') $null $reviewToken)
 Assert-ReviewCheck ($after.Count -eq 2) 'one new goal row, with original history retained'
 Write-Output 'Hosted adaptive reviews passed: Free denied, incomplete logs withheld, private 14-day evidence, unchanged preview, safe acknowledged acceptance and one-row idempotent retry.'
} finally {
 if($reviewFixture){$null=Invoke-ReviewCheck 'DELETE' ('/auth/v1/admin/users/'+$reviewFixture) $null $reviewServiceKey $reviewServiceKey;Write-Output 'Hosted adaptive review fixture cleanup completed.'}
}
