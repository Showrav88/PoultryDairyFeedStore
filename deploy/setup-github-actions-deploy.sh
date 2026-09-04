#!/usr/bin/env bash
# One-time VPS setup for GitHub Actions auto-deploy via HTTP webhook (port 8081).
# Run on the VPS as root:
#   sudo bash /var/www/NEWPROJECT/deploy/setup-github-actions-deploy.sh
set -Eeuo pipefail

DEPLOY_USER="newproject"
APP_DIR="/var/www/NEWPROJECT"
DEPLOY_CMD="/usr/local/sbin/deploy-newproject"
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

if [[ ! -x "$DEPLOY_CMD" ]]; then
  echo "Deploy command missing at $DEPLOY_CMD"
  exit 1
fi

echo "${DEPLOY_USER} ALL=(root) NOPASSWD: ${DEPLOY_CMD}" > "$SUDOERS_FILE"
chmod 440 "$SUDOERS_FILE"
visudo -cf "$SUDOERS_FILE"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  exit 1
fi

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

On VPS, DEPLOY_WEBHOOK_SECRET is saved in ${ENV_FILE}

Deploy the webhook endpoint once:
  sudo ${DEPLOY_CMD}

Then push to main or re-run "Deploy to Hostinger VPS" in GitHub Actions.
================================================================================
EOF
