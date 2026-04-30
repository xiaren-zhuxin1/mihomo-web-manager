# Deployment Guide

## Prerequisites

- Linux server (Ubuntu 24.04+) with mihomo installed as systemd service
- SSH access to the server
- Go 1.22+ and Node.js 18+ on the build machine
- Python 3 with `paramiko` (for Windows deploy script)

## Quick Deploy

### From Windows

```powershell
pip install paramiko
.\deploy\deploy.ps1 -Host 10.1.1.66 -User eric -Password yourpassword
```

### From Linux/macOS

```bash
./deploy/deploy.sh
# Or with custom target:
DEPLOY_HOST=10.1.1.66 DEPLOY_USER=eric DEPLOY_PASSWORD=xxx ./deploy/deploy.sh
```

The script will:
1. Build frontend (`npm run build`) and backend (`go build`)
2. Upload binary, web assets, env, and service file
3. Install everything and **fix `/etc/mihomo/` permissions** (chown to deploy user)
4. Restart the service
5. Verify health endpoint

## Manual Deploy

### 1. Build

```bash
cd web && npm ci && npm run build && cd ..
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o mihomo-manager .
```

### 2. Install Files

```bash
sudo install -m 755 mihomo-manager /opt/mihomo-web-manager/
sudo mkdir -p /opt/mihomo-web-manager/web
sudo cp -r web/dist/* /opt/mihomo-web-manager/web/
sudo cp deploy/mihomo-web-manager.env /opt/mihomo-web-manager/
sudo mkdir -p /opt/mihomo-web-manager/data /opt/mihomo-web-manager/backups
```

### 3. Fix Permissions

**Important:** The web-manager runs as a non-root user and needs read/write access to mihomo config:

```bash
sudo chown -R eric:eric /opt/mihomo-web-manager
sudo chown -R eric:eric /etc/mihomo
sudo find /etc/mihomo -type d -exec chmod 755 {} +
sudo find /etc/mihomo -type f -exec chmod 644 {} +
sudo find /etc/mihomo -name '*.db' -exec chmod 666 {} +
```

### 4. Configure

Edit `/opt/mihomo-web-manager/mihomo-web-manager.env`:

```env
MWM_LISTEN=:18080
MWM_DATA_DIR=/opt/mihomo-web-manager/data
MWM_BACKUP_DIR=/opt/mihomo-web-manager/backups
MWM_WEB_DIR=/opt/mihomo-web-manager/web
MWM_SERVICE_MODE=systemd

MIHOMO_CONTROLLER=http://127.0.0.1:9090
MIHOMO_SECRET=change-this-secret
MIHOMO_CONFIG=/etc/mihomo/config.yaml
```

### 5. Install systemd Service

```bash
sudo cp deploy/mihomo-web-manager.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now mihomo-web-manager
```

### 6. Verify

```bash
curl http://127.0.0.1:18080/api/health
```

## Mihomo Systemd Service

If mihomo is not yet installed as a systemd service:

```bash
# Download mihomo binary
curl -sL https://github.com/MetaCubeX/mihomo/releases/latest/download/mihomo-linux-amd64-latest.gz | gunzip > /tmp/mihomo
sudo install -m 755 /tmp/mihomo /usr/local/bin/mihomo

# Prepare config directory
sudo mkdir -p /etc/mihomo
# Copy your existing config here
sudo cp /path/to/existing/config.yaml /etc/mihomo/
sudo cp /path/to/existing/GeoIP.dat /etc/mihomo/
sudo cp /path/to/existing/GeoSite.dat /etc/mihomo/

# Fix permissions
sudo chown -R eric:eric /etc/mihomo
sudo find /etc/mihomo -type d -exec chmod 755 {} +
sudo find /etc/mihomo -type f -exec chmod 644 {} +

# Create systemd service
sudo tee /etc/systemd/system/mihomo.service << 'EOF'
[Unit]
Description=Mihomo Proxy Service
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/mihomo -d /etc/mihomo
Restart=on-failure
RestartSec=5
LimitNPROC=infinity
LimitNOFILE=infinity
CapabilityBoundingSet=CAP_NET_ADMIN CAP_NET_RAW CAP_NET_BIND_SERVICE
AmbientCapabilities=CAP_NET_ADMIN CAP_NET_RAW CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now mihomo
```

## Troubleshooting

### Permission denied on config files

```bash
sudo chown -R eric:eric /etc/mihomo
sudo find /etc/mihomo -type d -exec chmod 755 {} +
sudo find /etc/mihomo -type f -exec chmod 644 {} +
```

### Port already in use

```bash
sudo ss -tlnp | grep 18080
# Stop conflicting service
sudo systemctl stop mihomo-web-manager-test
```

### Check logs

```bash
sudo journalctl -u mihomo-web-manager -f
sudo journalctl -u mihomo -f
```
