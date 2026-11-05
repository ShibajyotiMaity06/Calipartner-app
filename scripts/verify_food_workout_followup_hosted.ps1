param()
$ErrorActionPreference = 'Stop'
if (-not ('CaliSupabaseCredential' -as [type])) { Add-Type -Path (Join-Path $env:LOCALAPPDATA 'CaliPartner/SupabaseCredential.cs') }
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$project = [IO.File]::ReadAllText((Join-Path $root 'supabase/.temp/project-ref')).Trim()
$management = @{ Authorization = 'Bearer ' + [CaliSupabaseCredential]::Read() }
$keys = Invoke-RestMethod -Uri ('https://api.supabase.com/v1/projects/' + $project + '/api-keys') -Headers $management
$serviceKey = ($keys | Where-Object { $_.name -eq 'service_role' } | Select-Object -First 1).api_key
$anonKey = ($keys | Where-Object { $_.name -eq 'anon' } | Select-Object -First 1).api_key
$base = 'https://' + $project + '.supabase.co'
function Invoke-FoodCheck([string]$Method, [string]$Path, $Body, [string]$Token, [string]$Key = $anonKey) {
 $options = @{ Method = $Method; Uri = $base + $Path; Headers = @{ apikey = $Key; Authorization = 'Bearer ' + $Token }; ContentType = 'application/json'; TimeoutSec = 45 }
 if ($Path -eq '/rest/v1/profiles') { $options.Headers.Prefer = 'resolution=merge-duplicates' }
 if ($null -ne $Body) { $options.Body = ConvertTo-Json -InputObject $Body -Depth 15 -Compress }
 try { $reply=Invoke-RestMethod @options; if ($reply -is [array]) { $reply | ForEach-Object { $_ } } else { $reply } } catch { throw ('Hosted food request failed: ' + $Path) }
}
function Assert-FoodCheck([bool]$Condition, [string]$Message) { if (-not $Condition) { throw ('Hosted food check failed: ' + $Message) } }
$fixture = $null
try {
 $suffix = [guid]::NewGuid().ToString('N').Substring(0,10)
 $email = 'foodlibrary_' + $suffix + '@example.invalid'
 $password = [guid]::NewGuid().ToString('N') + 'aA8!'
 $account = Invoke-FoodCheck 'POST' '/auth/v1/admin/users' @{ email=$email; password=$password; email_confirm=$true; user_metadata=@{fixture='food-library-check'} } $serviceKey $serviceKey
 $fixture = $account.id
 Assert-FoodCheck ([bool]$fixture) 'synthetic user created'
 $null = Invoke-FoodCheck 'POST' '/rest/v1/profiles' @{ id=$fixture; username=('food_' + $suffix); nickname='Food check'; date_of_birth='1995-01-01'; sex='male'; height_cm=175; timezone='UTC'; discoverable=$false } $serviceKey $serviceKey
 $session = Invoke-FoodCheck 'POST' '/auth/v1/token?grant_type=password' @{ email=$email; password=$password } $anonKey $anonKey
 $token = $session.access_token
 Assert-FoodCheck ([bool]$token) 'synthetic user authenticated'
 $foodId = [guid]::NewGuid().ToString(); $entryId = [guid]::NewGuid().ToString(); $now = [DateTime]::UtcNow.ToString('o')
 $food = @{ id=$foodId; source='user'; name='Hosted food correction'; brand=$null; barcode=$null; owner_id=$fixture; attribution='User created'; serving_units=@(@{unit='g';grams=1}); calories_per_100g=450; protein_per_100g=55; carbs_per_100g=30; fat_per_100g=10; fiber_per_100g=4; sugar_per_100g=0; sodium_mg_per_100g=0; created_at=$now; updated_at=$now; deleted_at=$null }
 $favorite = @{p_food_key=('user:'+$foodId);p_food=$food;p_favorite=$true}
 1..2 | ForEach-Object { $result = Invoke-FoodCheck 'POST' '/rest/v1/rpc/set_food_favorite' $favorite $token; Assert-FoodCheck ($result.favorite -eq $true) 'favourite acknowledged' }
 $library = Invoke-FoodCheck 'POST' '/rest/v1/rpc/get_food_library' @{} $token
 Assert-FoodCheck ($library.foods.Count -eq 1) 'favourite retry never duplicates'
 $entry = @{ id=$entryId; user_id=$fixture; food_id=$foodId; food_name=$food.name; brand_name=$null; meal_section='lunch'; quantity=100; unit='g'; calories=450; protein=50; carbs=30; fat=10; fiber=4; sugar=0; sodium_mg=0; logged_at=$now; local_date=[DateTime]::UtcNow.ToString('yyyy-MM-dd'); source='search'; updated_at=$now; deleted_at=$null }
 $changes = @{p_changes=@(@{id=$foodId;entity='foods';operation='upsert';payload=$food},@{id=$entryId;entity='food_entries';operation='upsert';payload=$entry})}
 1..2 | ForEach-Object { $null = Invoke-FoodCheck 'POST' '/rest/v1/rpc/save_tracking_changes' $changes $token }
 $entries = @(Invoke-FoodCheck 'GET' ('/rest/v1/food_entries?user_id=eq.'+$fixture+'&select=id,protein') $null $token)
 Assert-FoodCheck ($entries.Count -eq 1 -and $entries[0].protein -eq 50) 'corrected protein acknowledged once across retries'
 $catalog = @(Invoke-FoodCheck 'GET' ('/rest/v1/foods?id=eq.'+$foodId+'&select=protein_per_100g') $null $token)
 Assert-FoodCheck ($catalog[0].protein_per_100g -eq 55) 'catalog nutrition unchanged by portion correction'
 $null = Invoke-FoodCheck 'POST' '/rest/v1/rpc/record_food_search' @{p_query='  Hosted lentils  '} $token
 1..2 | ForEach-Object { $clear = Invoke-FoodCheck 'POST' '/rest/v1/rpc/clear_food_search_history' @{} $token; Assert-FoodCheck ($clear.cleared -eq $true) 'history clear acknowledged' }
 $library = Invoke-FoodCheck 'POST' '/rest/v1/rpc/get_food_library' @{} $token
 Assert-FoodCheck ($library.searches.Count -eq 0 -and $library.foods.Count -eq 1) 'clearing searches preserves favourites'
 $entries = @(Invoke-FoodCheck 'GET' ('/rest/v1/food_entries?user_id=eq.'+$fixture+'&select=id') $null $token)
 Assert-FoodCheck ($entries.Count -eq 1) 'clearing searches preserves diary'
 $resetId=[guid]::NewGuid().ToString()
 $reset=Invoke-FoodCheck 'POST' '/rest/v1/rpc/clear_recent_foods' @{p_id=$resetId} $token
 $retry=Invoke-FoodCheck 'POST' '/rest/v1/rpc/clear_recent_foods' @{p_id=$resetId} $token
 Assert-FoodCheck ($reset.cleared_at -eq $retry.cleared_at) 'recent clear retry retains the original cutoff'
 $library=Invoke-FoodCheck 'POST' '/rest/v1/rpc/get_food_library' @{} $token
 Assert-FoodCheck ($library.recent_foods_cleared_at -eq $reset.cleared_at -and $library.foods.Count -eq 1) 'recent clear preserves favourites'
 $entries=@(Invoke-FoodCheck 'GET' ('/rest/v1/food_entries?user_id=eq.'+$fixture+'&select=id') $null $token)
 Assert-FoodCheck ($entries.Count -eq 1) 'recent clear preserves actual diary entries'
 $starter='009ecc35-4e52-54cc-adb6-022db3bb5570'
 1..2 | ForEach-Object { $null=Invoke-FoodCheck 'POST' '/rest/v1/rpc/save_tracking_changes' @{p_changes=@(@{id=('recipe_fav:'+$fixture+':'+$starter);entity='recipe_favorites';operation='upsert';payload=@{user_id=$fixture;recipe_id=$starter}})} $token }
 $recipes=@(Invoke-FoodCheck 'GET' ('/rest/v1/recipe_favorites?user_id=eq.'+$fixture+'&select=recipe_id,created_at&order=created_at.asc') $null $token)
 Assert-FoodCheck ($recipes.Count -eq 1 -and $recipes[0].recipe_id -eq $starter) 'real starter recipe favourite saved once and readable using actual timestamp'
 1..2 | ForEach-Object { $null=Invoke-FoodCheck 'POST' '/rest/v1/rpc/save_tracking_changes' @{p_changes=@(@{id=('recipe_fav:'+$fixture+':'+$starter);entity='recipe_favorites';operation='delete';payload=@{user_id=$fixture;recipe_id=$starter}})} $token }
 $recipes=@(Invoke-FoodCheck 'GET' ('/rest/v1/recipe_favorites?user_id=eq.'+$fixture+'&select=recipe_id') $null $token)
 Assert-FoodCheck ($recipes.Count -eq 0) 'recipe removal retries acknowledged'
 Write-Output 'Hosted recipe and recent-food checks passed: real Free starter favourite/save/remove retries, stable recent-food reset timestamp, preserved diary and food favourites.'
 Write-Output 'Hosted food library passed: acknowledged private favourites, retry-safe corrected 50g protein, unchanged 55g catalog, and isolated search clearing without deleting diary entries.'
} finally {
 if ($fixture) { $null = Invoke-FoodCheck 'DELETE' ('/auth/v1/admin/users/'+$fixture) $null $serviceKey $serviceKey; Write-Output 'Hosted food fixture cleanup completed.' }
}
