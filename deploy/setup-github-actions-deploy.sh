#!/usr/bin/env bash
# One-time VPS setup for GitHub Actions auto-deploy via HTTP webhook (port 8081).
# Run on the VPS as root:
#   sudo bash /var/www/NEWPROJECT/deploy/setup-github-actions-deploy.sh
set -Eeuo pipefail

DEPLOY_USER="newproject"
APP_DIR="/var/www/NEWPROJECT"
DEPLOY_CMD="/usr/local/sbin/deploy-newproject"
SYNC_ORIGIN="/usr/local/sbin/sync-newproject-origin"
FIX_OWNERSHIP="/usr/local/sbin/fix-newproject-ownership"
TRIGGER_DEPLOY="/usr/local/sbin/trigger-newproject-deploy"
DEPLOY_UNIT="newproject-deploy.service"
SUDOERS_FILE="/etc/sudoers.d/newproject-deploy"
ENV_FILE="${APP_DIR}/.env"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash $0"
  exit 1
fi

if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  echo "User '$DEPLOY_USER' does not exist. Complete initial VPS setup first."
  exit 1
fi

echo "Installing system deploy helpers ..."
install -m 755 "${APP_DIR}/deploy/sbin-deploy-newproject" "$DEPLOY_CMD"
install -m 755 "${APP_DIR}/deploy/sbin-sync-newproject-origin" "$SYNC_ORIGIN"
install -m 755 "${APP_DIR}/deploy/fix-newproject-ownership.sh" "$FIX_OWNERSHIP"
install -m 755 "${APP_DIR}/deploy/trigger-newproject-deploy.sh" "$TRIGGER_DEPLOY"

echo "Installing systemd deploy unit ..."
install -m 644 "${APP_DIR}/deploy/newproject-deploy.service" "/etc/systemd/system/${DEPLOY_UNIT}"
systemctl daemon-reload
systemctl enable "$DEPLOY_UNIT" 2>/dev/null || true

cat > "$SUDOERS_FILE" <<EOF
# Webhook auto-deploy (user ${DEPLOY_USER} triggers via /api/deploy)
${DEPLOY_USER} ALL=(root) NOPASSWD: ${DEPLOY_CMD}
${DEPLOY_USER} ALL=(root) NOPASSWD: ${TRIGGER_DEPLOY}
${DEPLOY_USER} ALL=(root) NOPASSWD: ${SYNC_ORIGIN}
${DEPLOY_USER} ALL=(root) NOPASSWD: ${FIX_OWNERSHIP}
${DEPLOY_USER} ALL=(root) NOPASSWD: /bin/systemctl start ${DEPLOY_UNIT}
${DEPLOY_USER} ALL=(root) NOPASSWD: /usr/bin/systemctl start ${DEPLOY_UNIT}
${DEPLOY_USER} ALL=(root) NOPASSWD: /bin/systemctl stop newproject-api.service
${DEPLOY_USER} ALL=(root) NOPASSWD: /usr/bin/systemctl stop newproject-api.service
${DEPLOY_USER} ALL=(root) NOPASSWD: /bin/systemctl start newproject-api.service
${DEPLOY_USER} ALL=(root) NOPASSWD: /usr/bin/systemctl start newproject-api.service
${DEPLOY_USER} ALL=(root) NOPASSWD: /bin/systemctl restart newproject-api.service
${DEPLOY_USER} ALL=(root) NOPASSWD: /usr/bin/systemctl restart newproject-api.service
EOF
chmod 440 "$SUDOERS_FILE"
visudo -cf "$SUDOERS_FILE"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  exit 1
fi

echo "Fixing repo ownership for webhook deploy ..."
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "$APP_DIR"

if grep -q '^DEPLOY_WEBHOOK_SECRET=' "$ENV_FILE"; then
  DEPLOY_SECRET="$(grep '^DEPLOY_WEBHOOK_SECRET=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')"
else
  DEPLOY_SECRET="$(openssl rand -hex 32)"
  echo "DEPLOY_WEBHOOK_SECRET=\"${DEPLOY_SECRET}\"" >> "$ENV_FILE"
  chown "${DEPLOY_USER}:${DEPLOY_USER}" "$ENV_FILE"
fi

if [[ -f "${APP_DIR}/deploy/nginx-newproject.conf" ]]; then
  install -m 644 "${APP_DIR}/deploy/nginx-newproject.conf" /etc/nginx/sites-available/newproject
  nginx -t && systemctl reload nginx
fi

VPS_HOST="$(curl -fsS https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
DEPLOY_URL="http://${VPS_HOST}:8081/api/deploy"

cat <<EOF

================================================================================
GitHub Actions webhook auto-deploy (no SSH from GitHub needed)

Add these repository secrets (Settings → Secrets and variables → Actions):

DEPLOY_WEBHOOK_SECRET
${DEPLOY_SECRET}

VPS_DEPLOY_URL
${DEPLOY_URL}

Webhook starts: ${TRIGGER_DEPLOY} → systemctl start ${DEPLOY_UNIT}
(same script as manual: ${DEPLOY_CMD})

Test webhook path:
  sudo bash ${APP_DIR}/deploy/test-deploy-webhook.sh

Then push to main or re-run "Deploy to Hostinger VPS" in GitHub Actions.
================================================================================
EOF
