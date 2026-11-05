param()
$ErrorActionPreference = 'Stop'
if (-not ('CaliSupabaseCredential' -as [type])) { Add-Type -Path (Join-Path $env:LOCALAPPDATA 'CaliPartner/SupabaseCredential.cs') }
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$expected = ConvertFrom-Json -InputObject ([IO.File]::ReadAllText((Join-Path $root 'app/assets/supplied_food_products.json')))
$project = [IO.File]::ReadAllText((Join-Path $root 'supabase/.temp/project-ref')).Trim()
$management = @{ Authorization = 'Bearer ' + [CaliSupabaseCredential]::Read() }
$keys = Invoke-RestMethod -Uri ('https://api.supabase.com/v1/projects/' + $project + '/api-keys') -Headers $management
$serviceKey = ($keys | Where-Object { $_.name -eq 'service_role' } | Select-Object -First 1).api_key
$anonKey = ($keys | Where-Object { $_.name -eq 'anon' } | Select-Object -First 1).api_key
$base = 'https://' + $project + '.supabase.co'
function Invoke-ProductCheck([string]$Method, [string]$Path, $Body, [string]$Token, [string]$Key = $anonKey) {
 $options = @{ Method=$Method; Uri=$base+$Path; Headers=@{apikey=$Key; Authorization='Bearer '+$Token}; ContentType='application/json'; TimeoutSec=45 }
 if ($Path -eq '/rest/v1/profiles') { $options.Headers.Prefer='resolution=merge-duplicates' }
 if ($null -ne $Body) { $options.Body=ConvertTo-Json -InputObject $Body -Depth 15 -Compress }
 try { $reply=Invoke-RestMethod @options; if ($reply -is [array]) { $reply | ForEach-Object { $_ } } else { $reply } } catch { throw ('Hosted product request failed: '+$Path) }
}
function Assert-ProductCheck([bool]$Condition, [string]$Message) { if (-not $Condition) { throw ('Hosted product check failed: '+$Message) } }
$fixture=$null
try {
 $suffix=[guid]::NewGuid().ToString('N').Substring(0,10)
 $email='products_'+$suffix+'@example.invalid'; $password=[guid]::NewGuid().ToString('N')+'aA8!'
 $account=Invoke-ProductCheck 'POST' '/auth/v1/admin/users' @{email=$email;password=$password;email_confirm=$true;user_metadata=@{fixture='supplied-product-check'}} $serviceKey $serviceKey
 $fixture=$account.id
 Assert-ProductCheck ([bool]$fixture) 'private synthetic user created'
 $null=Invoke-ProductCheck 'POST' '/rest/v1/profiles' @{id=$fixture;username=('prod_'+$suffix);nickname='Product check';date_of_birth='1995-01-01';sex='male';height_cm=175;timezone='UTC';discoverable=$false} $serviceKey $serviceKey
 $session=Invoke-ProductCheck 'POST' '/auth/v1/token?grant_type=password' @{email=$email;password=$password} $anonKey $anonKey
 $token=$session.access_token
 Assert-ProductCheck ([bool]$token) 'private synthetic user authenticated'
 $catalog=@(Invoke-ProductCheck 'GET' '/rest/v1/foods?source=eq.supplied&select=id,name,brand,owner_id,serving_units,calories_per_100g,protein_per_100g,nutrition_details&limit=1000' $null $token)
 Write-Output ('Hosted product catalogue rows: '+$catalog.Count)
 foreach ($food in $expected) {
  $actual=@($catalog | Where-Object { $_.id -eq $food.id })
  Assert-ProductCheck ($actual.Count -eq 1) ('each supplied food is readable exactly once: '+$food.brand+' '+$food.name)
  Assert-ProductCheck ($actual[0].name -eq $food.name -and $actual[0].brand -eq $food.brand -and $null -eq $actual[0].owner_id) 'brand, name and public catalogue ownership preserved'
  Assert-ProductCheck ($actual[0].serving_units[0].grams -eq $food.serving_units[0].grams -and $actual[0].serving_units[0].unit -eq $food.serving_units[0].unit) 'original labelled serving preserved'
  Assert-ProductCheck ([math]::Abs($actual[0].calories_per_100g-$food.calories_per_100g) -lt 0.0051 -and [math]::Abs($actual[0].protein_per_100g-$food.protein_per_100g) -lt 0.0051) 'catalogue nutrition matches database precision'
  Assert-ProductCheck ($actual[0].nutrition_details.PSObject.Properties.Name -contains 'bcaa_g' -and $actual[0].nutrition_details.bcaa_g -eq $food.nutrition_details.bcaa_g) 'known and missing BCAA values retained'
  Assert-ProductCheck ($actual[0].nutrition_details.PSObject.Properties.Name -contains 'label_protein_per_100g' -and $actual[0].nutrition_details.label_protein_per_100g -eq $food.nutrition_details.label_protein_per_100g) 'original per-100g label retained, including null'
  Assert-ProductCheck ($actual[0].nutrition_details.not_provided -contains 'sodium_mg') 'unknown sodium is explicitly marked'
 }
 Assert-ProductCheck ($expected.Count -eq 156) 'all 156 complete source products included'
 $samples=@($expected | Where-Object { ($_.brand -eq 'MuscleBlaze' -and $_.name -eq 'Whey Gold Protein') -or ($_.brand -eq 'Premier Protein' -and $_.name -eq 'Protein Shake (Chocolate)') })
 Assert-ProductCheck ($samples.Count -eq 2) 'both representative servings found'
 $now=[DateTime]::UtcNow.ToString('o'); $day=[DateTime]::UtcNow.ToString('yyyy-MM-dd')
 $changes=@()
 foreach ($food in $samples) {
  $shake=$food.brand -eq 'Premier Protein'
  $id=[guid]::NewGuid().ToString()
  $details=@{bcaa_g=5.5;label_protein_per_100g=72.7;saturated_fat=$null;cholesterol_mg=$null;not_provided=@('sodium_mg')}
  if ($shake) { $details.bcaa_g=$null; $details.label_protein_per_100g=$null }
  $entry=@{id=$id;user_id=$fixture;food_id=$food.id;food_name=$food.name;brand_name=$food.brand;meal_section='lunch';quantity=1;unit=$food.serving_units[0].unit;calories=135;protein=24;carbs=4;fat=2;fiber=0;sugar=1.5;sodium_mg=0;nutrition_details=$details;logged_at=$now;local_date=$day;source='search';updated_at=$now;deleted_at=$null}
  if ($shake) { $entry.calories=160; $entry.protein=30; $entry.carbs=5; $entry.fat=3; $entry.fiber=1; $entry.sugar=1 }
  $changes+=@{id=$id;entity='food_entries';operation='upsert';payload=$entry}
 }
 1..2 | ForEach-Object { $null=Invoke-ProductCheck 'POST' '/rest/v1/rpc/save_tracking_changes' @{p_changes=$changes} $token }
 $entries=@(Invoke-ProductCheck 'GET' ('/rest/v1/food_entries?user_id=eq.'+$fixture+'&select=id,food_id,calories,protein,nutrition_details') $null $token)
 Assert-ProductCheck ($entries.Count -eq 2) 'acknowledged saves remain two entries after identical retry'
 foreach ($change in $changes) {
  $entry=@($entries | Where-Object { $_.id -eq $change.id })[0]
  Assert-ProductCheck ($entry.calories -eq $change.payload.calories -and $entry.protein -eq $change.payload.protein) 'original serving calories and protein saved'
  Assert-ProductCheck ($entry.nutrition_details.PSObject.Properties.Name -contains 'bcaa_g' -and $entry.nutrition_details.bcaa_g -eq $change.payload.nutrition_details.bcaa_g) 'diary retains supplied BCAA or explicit null'
  Assert-ProductCheck ($entry.nutrition_details.PSObject.Properties.Name -contains 'label_protein_per_100g' -and $entry.nutrition_details.label_protein_per_100g -eq $change.payload.nutrition_details.label_protein_per_100g) 'diary retains original label reference or explicit null'
 }
 Write-Output 'Hosted supplied products passed: all 156 readable foods, original servings, known and missing nutrition, acknowledged 135 kcal/24 g and 160 kcal/30 g diary saves, and duplicate-free retries.'
} finally {
 if ($fixture) { $null=Invoke-ProductCheck 'DELETE' ('/auth/v1/admin/users/'+$fixture) $null $serviceKey $serviceKey; Write-Output 'Hosted supplied-product fixture cleanup completed.' }
}
