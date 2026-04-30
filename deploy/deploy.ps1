param(
    [string]$Host = "10.1.1.66",
    [string]$User = "eric",
    [string]$Password = ""
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$RemoteBase = "/opt/mihomo-web-manager"
$MihomoConfigDir = "/etc/mihomo"

Write-Host "=== Mihomo Web Manager Deploy ===" -ForegroundColor Cyan
Write-Host "Target: ${User}@${Host}"

# ── 1. Build ──────────────────────────────────────────
Write-Host ""
Write-Host "[1/5] Building frontend..." -ForegroundColor Yellow
Push-Location "$ProjectRoot\web"
npm run build
Pop-Location

Write-Host "[1/5] Building backend..." -ForegroundColor Yellow
$env:GOOS = "linux"
$env:GOARCH = "amd64"
$env:CGO_ENABLED = "0"
go build -o "$ProjectRoot\mihomo-manager-linux" .
Remove-Item Env:\GOOS; Remove-Item Env:\GOARCH; Remove-Item Env:\CGO_ENABLED

# ── 2. Upload ─────────────────────────────────────────
Write-Host ""
Write-Host "[2/5] Uploading files..." -ForegroundColor Yellow

function SshExec($cmd) {
    $script = @"
import paramiko, sys
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('$Host', username='$User', password='$Password', timeout=15)
stdin, stdout, stderr = c.exec_command("echo '$Password' | sudo -S bash -c '$cmd'", timeout=60)
out = stdout.read().decode('utf-8', errors='replace').strip()
err = stderr.read().decode('utf-8', errors='replace').strip()
if out: print(out)
if err and 'password' not in err.lower() and '[sudo]' not in err:
    print(f'ERR: {{err}}', file=sys.stderr)
c.close()
"@
    $script | python -
}

function SftpUpload($local, $remote) {
    $script = @"
import paramiko, sys, os
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('$Host', username='$User', password='$Password', timeout=15)
sftp = c.open_sftp()
sftp.put(r'$local', '$remote')
sftp.close()
c.close()
"@
    $script | python -
}

function SftpUploadDir($localDir, $remoteDir) {
    $script = @"
import paramiko, sys, os

def upload_dir(sftp, local_path, remote_path):
    try:
        sftp.stat(remote_path)
    except FileNotFoundError:
        sftp.mkdir(remote_path)
    for item in os.listdir(local_path):
        li = os.path.join(local_path, item)
        ri = remote_path + '/' + item
        if os.path.isdir(li):
            upload_dir(sftp, li, ri)
        else:
            sftp.put(li, ri)

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('$Host', username='$User', password='$Password', timeout=15)
sftp = c.open_sftp()
upload_dir(sftp, r'$localDir', '$remoteDir')
sftp.close()
c.close()
"@
    $script | python -
}

SftpUpload "$ProjectRoot\mihomo-manager-linux" "/tmp/mihomo-manager"
SftpUploadDir "$ProjectRoot\web\dist" "/tmp/mwm-web"
SftpUpload "$ProjectRoot\deploy\mihomo-web-manager.env" "/tmp/mwm.env"
SftpUpload "$ProjectRoot\deploy\mihomo-web-manager.service" "/tmp/mwm.service"

# ── 3. Install ────────────────────────────────────────
Write-Host ""
Write-Host "[3/5] Installing on server..." -ForegroundColor Yellow

SshExec @"
systemctl stop mihomo-web-manager 2>/dev/null; install -m 755 /tmp/mihomo-manager $RemoteBase/mihomo-manager
"@

SshExec @"
rm -rf $RemoteBase/web.old; [ -d $RemoteBase/web ] && mv $RemoteBase/web $RemoteBase/web.old; mkdir -p $RemoteBase/web; cp -r /tmp/mwm-web/* $RemoteBase/web/
"@

SshExec @"
install -m 644 /tmp/mwm.env $RemoteBase/mihomo-web-manager.env
"@

SshExec @"
mkdir -p $RemoteBase/data $RemoteBase/backups
"@

SshExec @"
chown -R ${User}:${User} $RemoteBase && chmod 755 $RemoteBase/mihomo-manager
"@

SshExec @"
install -m 644 /tmp/mwm.service /etc/systemd/system/mihomo-web-manager.service && systemctl daemon-reload && systemctl enable mihomo-web-manager
"@

# ── Fix /etc/mihomo permissions ──────────────────────
Write-Host "  Fixing $MihomoConfigDir permissions..." -ForegroundColor Gray

SshExec @"
if [ -d '$MihomoConfigDir' ]; then
    chown -R ${User}:${User} $MihomoConfigDir
    find $MihomoConfigDir -type d -exec chmod 755 {} +
    find $MihomoConfigDir -type f -exec chmod 644 {} +
    find $MihomoConfigDir -name '*.db' -exec chmod 666 {} +
fi
"@

SshExec "rm -f /tmp/mihomo-manager /tmp/mwm.env /tmp/mwm.service; rm -rf /tmp/mwm-web"

# ── 4. Restart ────────────────────────────────────────
Write-Host ""
Write-Host "[4/5] Restarting service..." -ForegroundColor Yellow
SshExec "systemctl restart mihomo-web-manager"
Start-Sleep -Seconds 2

# ── 5. Verify ─────────────────────────────────────────
Write-Host ""
Write-Host "[5/5] Verifying..." -ForegroundColor Yellow

$result = SshExec "curl -sf http://127.0.0.1:18080/api/health"

if ($result -match '"ok":true') {
    Write-Host "  Deploy successful!" -ForegroundColor Green
    Write-Host "  WebUI: http://${Host}:18080"
    Write-Host "  Health: $result"
} else {
    Write-Host "  Deploy FAILED!" -ForegroundColor Red
    SshExec "journalctl -u mihomo-web-manager -n 10 --no-pager"
    exit 1
}

Remove-Item "$ProjectRoot\mihomo-manager-linux" -Force -ErrorAction SilentlyContinue
