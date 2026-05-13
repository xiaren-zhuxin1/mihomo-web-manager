param(
    [switch]$SkipBuild,
    [switch]$SkipUpload,
    [string]$Notes = ""
)

Import-Module Posh-SSH

$ErrorActionPreference = "Stop"
$ScriptDir = $PSScriptRoot
if (-not $ScriptDir) { $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
$ProjectRoot = Split-Path -Parent $ScriptDir
$ConfigPath = Join-Path $ScriptDir "deploy.config.psd1"

if (-not (Test-Path $ConfigPath)) {
    Write-Host "Error: Config file not found $ConfigPath" -ForegroundColor Red
    exit 1
}

$Config = Import-PowerShellDataFile $ConfigPath
$Server = $Config.Server
$User = $Config.User
$Password = $Config.Password
$RemoteDir = $Config.RemoteDir
$Port = $Config.Port
$MihomoSecret = $Config.MihomoSecret

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Mihomo Web Manager Deploy" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Target: ${User}@${Server}:${Port}" -ForegroundColor Yellow
Write-Host "Path: $RemoteDir" -ForegroundColor Yellow
Write-Host ""

$secPass = ConvertTo-SecureString $Password -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential($User, $secPass)

Write-Host "[1/6] Connecting..." -ForegroundColor Yellow
$sftp = New-SFTPSession -ComputerName $Server -Credential $cred -AcceptKey
$ssh = New-SSHSession -ComputerName $Server -Credential $cred -AcceptKey

if (-not $SkipBuild) {
    Write-Host "`n[2/6] Building frontend..." -ForegroundColor Yellow
    Push-Location "$ProjectRoot\web"
    $buildResult = npm run build 2>&1
    Pop-Location
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Build failed!" -ForegroundColor Red
        Write-Host $buildResult
        Remove-SFTPSession -SessionId $sftp.SessionId | Out-Null
        Remove-SSHSession -SessionId $ssh.SessionId | Out-Null
        exit 1
    }
    
    $jsFile = Get-ChildItem "$ProjectRoot\web\dist\assets\*.js" | Select-Object -First 1
    $cssFile = Get-ChildItem "$ProjectRoot\web\dist\assets\*.css" | Select-Object -First 1
    Write-Host "  JS: $($jsFile.Name) ($([Math]::Round($jsFile.Length/1KB)) KB)" -ForegroundColor Gray
    Write-Host "  CSS: $($cssFile.Name) ($([Math]::Round($cssFile.Length/1KB)) KB)" -ForegroundColor Gray
} else {
    Write-Host "`n[2/6] Skip build" -ForegroundColor Gray
}

Write-Host "`n[3/6] Stopping old service..." -ForegroundColor Yellow
Invoke-SSHCommand -SessionId $ssh.SessionId -Command 'pkill -f mihomo-manager-linux || true' | Out-Null

if (-not $SkipUpload) {
    Write-Host "`n[4/6] Uploading files..." -ForegroundColor Yellow
    Invoke-SSHCommand -SessionId $ssh.SessionId -Command "rm -rf $RemoteDir/web/dist/* && mkdir -p $RemoteDir/web/dist/assets" | Out-Null
    
    $uploadTime = Measure-Command {
        Write-Host "  Uploading index.html..." -ForegroundColor Gray
        Set-SFTPItem -SessionId $sftp.SessionId -Path "$ProjectRoot\web\dist\index.html" -Destination "$RemoteDir/web/dist/" -Force
        
        Write-Host "  Uploading assets..." -ForegroundColor Gray
        Get-ChildItem "$ProjectRoot\web\dist\assets\*" | ForEach-Object {
            Write-Host "    $($_.Name)" -ForegroundColor DarkGray
            Set-SFTPItem -SessionId $sftp.SessionId -Path $_.FullName -Destination "$RemoteDir/web/dist/assets/" -Force
        }
    }
    Write-Host "  Upload time: $([Math]::Round($uploadTime.TotalMilliseconds))ms" -ForegroundColor Green
} else {
    Write-Host "`n[4/6] Skip upload" -ForegroundColor Gray
}

Write-Host "`n[5/6] Verifying files..." -ForegroundColor Yellow
$r = Invoke-SSHCommand -SessionId $ssh.SessionId -Command "ls -la $RemoteDir/web/dist/assets/"
$files = $r.Output -split "`n" | Where-Object { $_ -match "\.js|\.css" }
Write-Host "  Files: $(($files | Measure-Object).Count)" -ForegroundColor Gray

Write-Host "`n[6/6] Starting service..." -ForegroundColor Yellow
$startCmd = "cd $RemoteDir && MWM_LISTEN=:$Port MIHOMO_SECRET=$MihomoSecret nohup ./mihomo-manager-linux > /tmp/webui.log 2>&1 & disown"
Invoke-SSHCommand -SessionId $ssh.SessionId -Command $startCmd -TimeOut 5 -ErrorAction SilentlyContinue | Out-Null

Start-Sleep -Seconds 2

Write-Host "`n==========================================" -ForegroundColor Cyan
$r = Invoke-SSHCommand -SessionId $ssh.SessionId -Command "curl -s http://127.0.0.1:$Port/api/health"
try {
    $health = $r.Output | ConvertFrom-Json
    Write-Host "Version: $($health.version)" -ForegroundColor Green
    Write-Host "Build: $($health.buildDate)" -ForegroundColor Green
    Write-Host "Status: Running" -ForegroundColor Green
    
    $dateStr = Get-Date -Format "yyyy-MM-dd HH:mm"
    $logEntry = "$dateStr - $($health.version) - Port:$Port - OK - $Notes"
    $logPath = Join-Path $ProjectRoot "deploy\deploy.log"
    Add-Content -Path $logPath -Value $logEntry
    
} catch {
    Write-Host "Service start failed!" -ForegroundColor Red
    Write-Host $r.Output
}

Remove-SFTPSession -SessionId $sftp.SessionId | Out-Null
Remove-SSHSession -SessionId $ssh.SessionId | Out-Null

Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "  Deploy complete!" -ForegroundColor Green
Write-Host "  URL: http://${Server}:${Port}" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Green
