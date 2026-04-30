#!/usr/bin/env bash
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-eric}"
DEPLOY_HOST="${DEPLOY_HOST:-10.1.1.66}"
DEPLOY_PASSWORD="${DEPLOY_PASSWORD:-}"
REMOTE_BASE="/opt/mihomo-web-manager"
MIHOMO_CONFIG_DIR="/etc/mihomo"
BUILD_DIR=$(mktemp -d)

cleanup() { rm -rf "$BUILD_DIR"; }
trap cleanup EXIT

echo "=== Mihomo Web Manager Deploy ==="
echo "Target: ${DEPLOY_USER}@${DEPLOY_HOST}"

# ── 1. Build ──────────────────────────────────────────
echo ""
echo "[1/5] Building frontend..."
cd "$(dirname "$0")/../web"
npm ci --quiet
npm run build

echo "[1/5] Building backend..."
cd "$(dirname "$0")/.."
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o "${BUILD_DIR}/mihomo-manager" .

# ── 2. Upload ─────────────────────────────────────────
echo ""
echo "[2/5] Uploading files..."
ssh_cmd="ssh -o StrictHostKeyChecking=no ${DEPLOY_USER}@${DEPLOY_HOST}"

if [ -n "$DEPLOY_PASSWORD" ]; then
    ssh_cmd="sshpass -p '${DEPLOY_PASSWORD}' ssh -o StrictHostKeyChecking=no ${DEPLOY_USER}@${DEPLOY_HOST}"
    scp_cmd="sshpass -p '${DEPLOY_PASSWORD}' scp -o StrictHostKeyChecking=no"
else
    scp_cmd="scp -o StrictHostKeyChecking=no"
fi

$scp_cmd "${BUILD_DIR}/mihomo-manager" "${DEPLOY_USER}@${DEPLOY_HOST}:/tmp/mihomo-manager"
$scp_cmd -r web/dist/* "${DEPLOY_USER}@${DEPLOY_HOST}:/tmp/mwm-web/"
$scp_cmd deploy/mihomo-web-manager.env "${DEPLOY_USER}@${DEPLOY_HOST}:/tmp/mwm.env"
$scp_cmd deploy/mihomo-web-manager.service "${DEPLOY_USER}@${DEPLOY_HOST}:/tmp/mwm.service"

# ── 3. Install ────────────────────────────────────────
echo ""
echo "[3/5] Installing on server..."
$ssh_cmd sudo bash -s <<'REMOTE_SCRIPT'
set -e

REMOTE_BASE="/opt/mihomo-web-manager"
MIHOMO_CONFIG_DIR="/etc/mihomo"

# Stop service before replacing binary (avoids "Text file busy")
systemctl stop mihomo-web-manager 2>/dev/null || true

# Install binary
install -m 755 /tmp/mihomo-manager ${REMOTE_BASE}/mihomo-manager

# Install web assets
rm -rf ${REMOTE_BASE}/web.old
[ -d ${REMOTE_BASE}/web ] && mv ${REMOTE_BASE}/web ${REMOTE_BASE}/web.old
mkdir -p ${REMOTE_BASE}/web
cp -r /tmp/mwm-web/* ${REMOTE_BASE}/web/

# Install env
install -m 644 /tmp/mwm.env ${REMOTE_BASE}/mihomo-web-manager.env

# Create data dirs
mkdir -p ${REMOTE_BASE}/data ${REMOTE_BASE}/backups

# Fix ownership for web-manager
chown -R eric:eric ${REMOTE_BASE}

# Ensure binary is executable
chmod 755 ${REMOTE_BASE}/mihomo-manager

# Install systemd service
install -m 644 /tmp/mwm.service /etc/systemd/system/mihomo-web-manager.service
systemctl daemon-reload
systemctl enable mihomo-web-manager

# ── Fix /etc/mihomo permissions ──────────────────────
# Ensure eric can read/write mihomo config and providers
if [ -d "${MIHOMO_CONFIG_DIR}" ]; then
    chown -R eric:eric ${MIHOMO_CONFIG_DIR}
    find ${MIHOMO_CONFIG_DIR} -type d -exec chmod 755 {} +
    find ${MIHOMO_CONFIG_DIR} -type f -exec chmod 644 {} +
    find ${MIHOMO_CONFIG_DIR} -name '*.db' -exec chmod 666 {} +
    echo "  Fixed ${MIHOMO_CONFIG_DIR} permissions (owner: eric)"
fi

# Cleanup temp files
rm -f /tmp/mihomo-manager /tmp/mwm.env /tmp/mwm.service
rm -rf /tmp/mwm-web

REMOTE_SCRIPT

# ── 4. Restart ────────────────────────────────────────
echo ""
echo "[4/5] Restarting service..."
$ssh_cmd sudo systemctl restart mihomo-web-manager
sleep 2

# ── 5. Verify ─────────────────────────────────────────
echo ""
echo "[5/5] Verifying..."
STATUS=$($ssh_cmd curl -sf http://127.0.0.1:18080/api/health 2>/dev/null || echo "FAILED")

if echo "$STATUS" | grep -q '"ok":true'; then
    echo "  ✅ Deploy successful!"
    echo "  WebUI: http://${DEPLOY_HOST}:18080"
    echo "  Health: $STATUS"
else
    echo "  ❌ Deploy failed! Checking logs..."
    $ssh_cmd sudo journalctl -u mihomo-web-manager -n 10 --no-pager
    exit 1
fi
