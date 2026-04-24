# Deployment Guide

This guide assumes a Linux server with mihomo already running.

## 1. Build

```bash
cd web
npm ci
npm run build
cd ..
go build -o mihomo-manager ./cmd/mihomo-manager
```

## 2. Prepare Files

```bash
sudo mkdir -p /opt/mihomo-web-manager
sudo cp mihomo-manager /opt/mihomo-web-manager/
sudo mkdir -p /opt/mihomo-web-manager/web
sudo cp -r web/dist /opt/mihomo-web-manager/web/dist
sudo cp deploy/mihomo-web-manager.env /opt/mihomo-web-manager/
```

Edit:

```bash
sudo nano /opt/mihomo-web-manager/mihomo-web-manager.env
```

## 3. Install systemd Unit

```bash
sudo cp deploy/mihomo-web-manager.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now mihomo-web-manager
```

## 4. Check

```bash
systemctl status mihomo-web-manager
journalctl -u mihomo-web-manager -f
```

## Docker Mihomo Notes

When mihomo runs in Docker, set:

```bash
MWM_SERVICE_MODE=docker
MIHOMO_CONTAINER=mihomo
MIHOMO_CONFIG=/path/on/host/config.yaml
```

The `MIHOMO_CONFIG` path must be the host-side config path, not the in-container path.

