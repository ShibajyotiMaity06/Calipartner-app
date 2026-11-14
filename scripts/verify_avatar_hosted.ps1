$ErrorActionPreference = 'Stop'
if (-not ('CaliSupabaseCredential' -as [type])) { Add-Type -Path (Join-Path $env:LOCALAPPDATA 'CaliPartner/SupabaseCredential.cs') }
try {
  $env:CALI_AVATAR_MANAGEMENT_TOKEN = [CaliSupabaseCredential]::Read()
  & node (Join-Path $PSScriptRoot 'verify_avatar_hosted.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'Hosted avatar verification failed.' }
} finally {
  Remove-Item Env:CALI_AVATAR_MANAGEMENT_TOKEN -ErrorAction SilentlyContinue
}
