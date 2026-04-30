$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$WebDir = Join-Path $ProjectRoot "web"
$DistDir = Join-Path $WebDir "dist"
$RemoteHost = "192.168.231.66"
$RemoteUser = "ai"
$RemotePass = "123456"
$RemotePath = "/home/ai/mihomo-webui"

Write-Host "=== Mihomo Web Manager Deploy Script ===" -ForegroundColor Cyan

$versionFile = Join-Path $ProjectRoot "internal\app\version.go"
$versionContent = Get-Content $versionFile -Raw
if ($versionContent -match 'Version = "v(\d+)\.(\d+)\.(\d+)"') {
    $major = [int]$matches[1]
    $minor = [int]$matches[2]
    $patch = [int]$matches[3]
    $newPatch = $patch + 1
    $newVersion = "v$major.$minor.$newPatch"
    $newDate = Get-Date -Format "yyyy-MM-dd"
    
    Write-Host "Current version: v$major.$minor.$patch" -ForegroundColor Yellow
    Write-Host "New version: $newVersion" -ForegroundColor Green
    
    $versionContent = $versionContent -replace 'Version = "v[\d.]+"', "Version = `"$newVersion`""
    $versionContent = $versionContent -replace 'BuildDate = "[\d-]+"', "BuildDate = `"$newDate`""
    Set-Content $versionFile $versionContent -NoNewline
    Write-Host "Version updated in version.go" -ForegroundColor Green
}

$frontendVersionPattern = "const FRONTEND_VERSION = 'v[\d.]+';"
$frontendVersionReplacement = "const FRONTEND_VERSION = '$newVersion';"
$mainTsx = Join-Path $WebDir "src\main.tsx"
$mainContent = Get-Content $mainTsx -Raw -Encoding UTF8
if ($mainContent -match $frontendVersionPattern) {
    $mainContent = $mainContent -replace $frontendVersionPattern, $frontendVersionReplacement
    [System.IO.File]::WriteAllText($mainTsx, $mainContent, [System.Text.Encoding]::UTF8)
    Write-Host "Version updated in main.tsx" -ForegroundColor Green
} else {
    Write-Host "FRONTEND_VERSION not found in main.tsx, skipping" -ForegroundColor Yellow
}

Write-Host "`n[1/5] Building frontend..." -ForegroundColor Cyan
Push-Location $WebDir
npm run build
if ($LASTEXITCODE -ne 0) {
    Pop-Location
    throw "Frontend build failed"
}
Pop-Location
Write-Host "Frontend build completed" -ForegroundColor Green

Write-Host "`n[2/5] Uploading files to remote server..." -ForegroundColor Cyan
Import-Module Posh-SSH -ErrorAction Stop
$secPassword = ConvertTo-SecureString $RemotePass -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential($RemoteUser, $secPassword)

$session = New-SSHSession -ComputerName $RemoteHost -Credential $cred -AcceptKey
Invoke-SSHCommand -SessionId $session.SessionId -Command "rm -rf $RemotePath/web/dist/*" | Out-Null
Remove-SSHSession -SessionId $session.SessionId | Out-Null

$sftp = New-SFTPSession -ComputerName $RemoteHost -Credential $cred -AcceptKey
Set-SFTPItem -SessionId $sftp.SessionId -Path "$DistDir\*" -Destination "$RemotePath/web/dist/" -Force
Set-SFTPItem -SessionId $sftp.SessionId -Path "$DistDir\index.html" -Destination "$RemotePath/web/dist/" -Force
Set-SFTPItem -SessionId $sftp.SessionId -Path "$ProjectRoot\internal\app\version.go" -Destination "$RemotePath/internal/app/" -Force
Remove-SFTPSession -SessionId $sftp.SessionId | Out-Null
Write-Host "Files uploaded" -ForegroundColor Green

Write-Host "`n[3/5] Building backend on remote server..." -ForegroundColor Cyan
$session = New-SSHSession -ComputerName $RemoteHost -Credential $cred -AcceptKey
$result = Invoke-SSHCommand -SessionId $session.SessionId -Command "cd $RemotePath && go build -o mihomo-web-manager . 2>&1"
if ($result.ExitStatus -ne 0) {
    Remove-SSHSession -SessionId $session.SessionId | Out-Null
    throw "Backend build failed: $($result.Output)"
}
Write-Host "Backend build completed" -ForegroundColor Green

Write-Host "`n[4/5] Restarting service..." -ForegroundColor Cyan
Invoke-SSHCommand -SessionId $session.SessionId -Command "pkill -f mihomo-web-manager 2>/dev/null; sleep 1" | Out-Null
Invoke-SSHCommand -SessionId $session.SessionId -Command "cd $RemotePath && MIHOMO_CONTROLLER='127.0.0.1:9090' MIHOMO_SECRET='mihomo123' MIHOMO_CONFIG='/home/ai/mihomo/config/config.yaml' WEB_DIR='$RemotePath/web/dist' MWM_LISTEN='0.0.0.0:8081' nohup ./mihomo-web-manager >> app.log 2>&1 &" | Out-Null
Start-Sleep -Seconds 2
Write-Host "Service restarted" -ForegroundColor Green

Write-Host "`n[5/5] Verifying deployment..." -ForegroundColor Cyan
$result = Invoke-SSHCommand -SessionId $session.SessionId -Command "curl -s 'http://127.0.0.1:8081/api/health'"
Remove-SSHSession -SessionId $session.SessionId | Out-Null

$health = $result.Output | ConvertFrom-Json
if ($health.version -eq $newVersion) {
    Write-Host "`n=== Deployment Successful ===" -ForegroundColor Green
    Write-Host "Version: $($health.version)" -ForegroundColor Cyan
    Write-Host "Build Date: $($health.buildDate)" -ForegroundColor Cyan
    Write-Host "URL: http://$RemoteHost`:8081" -ForegroundColor Cyan
} else {
    Write-Host "`nWarning: Version mismatch. Expected $newVersion, got $($health.version)" -ForegroundColor Yellow
}
