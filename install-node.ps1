$log = Join-Path $PSScriptRoot 'install-node.log'
"START $(Get-Date)" | Out-File $log -Encoding utf8
$cmd = 'C:\Windows\System32\cmd.exe'
if (-not (Test-Path $cmd)) { "NO CMD" | Out-File $log -Append -Encoding utf8; exit 1 }
"CMD EXISTS: $cmd" | Out-File $log -Append -Encoding utf8
$winget = 'C:\Users\femin\AppData\Local\Microsoft\WindowsApps\winget.exe'
if (-not (Test-Path $winget)) { "NO WINGET" | Out-File $log -Append -Encoding utf8; exit 1 }
"WINGET EXISTS: $winget" | Out-File $log -Append -Encoding utf8
try {
    & $winget install --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements 2>&1 | Tee-Object -FilePath $log -Append -Encoding utf8
    "WINGET EXITCODE: $LASTEXITCODE" | Out-File $log -Append -Encoding utf8
} catch {
    "WINGET ERROR: $_" | Out-File $log -Append -Encoding utf8
    exit 1
}
"NODE PATH EXISTS: $(Test-Path 'C:\Program Files\nodejs\node.exe')" | Out-File $log -Append -Encoding utf8
"NPM PATH EXISTS: $(Test-Path 'C:\Program Files\nodejs\npm.cmd')" | Out-File $log -Append -Encoding utf8
"NODE PATH EXISTS2: $(Test-Path 'C:\Users\femin\AppData\Local\Programs\nodejs\node.exe')" | Out-File $log -Append -Encoding utf8
"NPM PATH EXISTS2: $(Test-Path 'C:\Users\femin\AppData\Local\Programs\nodejs\npm.cmd')" | Out-File $log -Append -Encoding utf8
Get-Command node -ErrorAction SilentlyContinue | Out-File $log -Append -Encoding utf8
Get-Command npm -ErrorAction SilentlyContinue | Out-File $log -Append -Encoding utf8
"END $(Get-Date)" | Out-File $log -Append -Encoding utf8
