$ErrorActionPreference = 'Stop'
if (-not ('CaliSupabaseCredential' -as [type])) { Add-Type -Path (Join-Path $env:LOCALAPPDATA 'CaliPartner/SupabaseCredential.cs') }
$project = [IO.File]::ReadAllText((Join-Path $PSScriptRoot '../supabase/.temp/project-ref')).Trim()
$headers = @{ Authorization = 'Bearer ' + [CaliSupabaseCredential]::Read() }
# Only aggregate quality counts leave the database: no users, recipes, goals or health inputs.
$query = @"
with meals as (
 select p.user_id,day->>'day' as day,
 jsonb_build_array(meal->'calories',meal->'protein',meal->'carbs',meal->'fat') as nutrition,
 jsonb_build_array(meal->'ingredients',meal->'portion') as recipe
 from public.personal_weekly_plans p cross join lateral jsonb_array_elements(p.content->'days') day cross join lateral jsonb_array_elements(day->'meals') meal
), daily as (
 select user_id,day,count(distinct nutrition) as nutrition_count,count(distinct recipe) as recipe_count from meals group by user_id,day
)
select (select count(*) from public.personal_weekly_plans) as saved_plans,
 (select count(*) from meals) as meals_checked,
 (select count(distinct user_id) from daily where nutrition_count=1 and recipe_count>1) as plans_with_copied_daily_macros,
 (select count(*) from daily where nutrition_count=1 and recipe_count>1) as affected_days;
"@
$result = Invoke-RestMethod -Method Post -Uri ('https://api.supabase.com/v1/projects/' + $project + '/database/query') -Headers $headers -ContentType 'application/json' -Body (@{query=$query} | ConvertTo-Json -Compress) -TimeoutSec 45
$result | ConvertTo-Json -Compress
