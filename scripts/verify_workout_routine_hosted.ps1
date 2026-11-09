$ErrorActionPreference = 'Stop'
if (-not ('CaliSupabaseCredential' -as [type])) {
 Add-Type -Path (Join-Path $env:LOCALAPPDATA 'CaliPartner/SupabaseCredential.cs')
}
$previousWorkoutCredential = $env:CALI_WORKOUT_MANAGEMENT_TOKEN
try {
 $env:CALI_WORKOUT_MANAGEMENT_TOKEN = [CaliSupabaseCredential]::Read()
 & node (Join-Path $PSScriptRoot 'verify_workout_routine_hosted.mjs') @args
 $workoutCheckExit = $LASTEXITCODE
} finally {
 $env:CALI_WORKOUT_MANAGEMENT_TOKEN = $previousWorkoutCredential
}
if ($workoutCheckExit -ne 0) { throw "Hosted workout verification failed (exit $workoutCheckExit)." }
