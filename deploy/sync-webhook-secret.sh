#!/usr/bin/env bash
# Generate (or rotate) DEPLOY_WEBHOOK_SECRET on the VPS and print the value for GitHub.
# Run on the VPS as root:
#   sudo bash /var/www/NEWPROJECT/deploy/sync-webhook-secret.sh
# Force a new secret even if one already exists:
#   sudo bash /var/www/NEWPROJECT/deploy/sync-webhook-secret.sh --rotate
set -Eeuo pipefail

APP_DIR="/var/www/NEWPROJECT"
APP_USER="newproject"
ENV_FILE="${APP_DIR}/.env"
SERVICE="newproject-api.service"
LOCAL_DEPLOY_URL="http://127.0.0.1:5001/api/deploy"
PUBLIC_DEPLOY_URL="http://31.97.50.25:8081/api/deploy"

ROTATE=false
if [[ "${1:-}" == "--rotate" ]]; then
  ROTATE=true
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash $0 [--rotate]"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — create it first (see DEPLOYMENT.md)."
  exit 1
fi

if grep -q '^DEPLOY_WEBHOOK_SECRET=' "$ENV_FILE" && [[ "$ROTATE" == false ]]; then
  DEPLOY_SECRET="$(grep '^DEPLOY_WEBHOOK_SECRET=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
  if [[ -n "$DEPLOY_SECRET" ]]; then
    echo "DEPLOY_WEBHOOK_SECRET already exists in $ENV_FILE"
    echo "Use --rotate to generate a new secret and update GitHub to match."
  else
    DEPLOY_SECRET="$(openssl rand -hex 32)"
    sed -i "s/^DEPLOY_WEBHOOK_SECRET=.*/DEPLOY_WEBHOOK_SECRET=\"${DEPLOY_SECRET}\"/" "$ENV_FILE"
  fi
else
  DEPLOY_SECRET="$(openssl rand -hex 32)"
  if grep -q '^DEPLOY_WEBHOOK_SECRET=' "$ENV_FILE"; then
    sed -i "s/^DEPLOY_WEBHOOK_SECRET=.*/DEPLOY_WEBHOOK_SECRET=\"${DEPLOY_SECRET}\"/" "$ENV_FILE"
  else
    echo "DEPLOY_WEBHOOK_SECRET=\"${DEPLOY_SECRET}\"" >> "$ENV_FILE"
  fi
fi

chown "${APP_USER}:${APP_USER}" "$ENV_FILE"
chmod 600 "$ENV_FILE"

echo "Restarting ${SERVICE} so the app loads the new secret ..."
systemctl restart "$SERVICE"
sleep 4

if ! systemctl is-active --quiet "$SERVICE"; then
  echo "WARNING: ${SERVICE} is not active. Check: journalctl -u ${SERVICE} -n 40"
  exit 1
fi

echo "Testing local webhook ..."
response=$(curl -sS -w "\nHTTP_CODE:%{http_code}" -X POST "$LOCAL_DEPLOY_URL" \
  -H "Authorization: Bearer ${DEPLOY_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"sha":"secret-sync-test"}' || true)

body="${response%HTTP_CODE:*}"
code="${response##*HTTP_CODE:}"

cat <<EOF

================================================================================
Copy these values into GitHub → Settings → Secrets and variables → Actions

Repository secret: DEPLOY_WEBHOOK_SECRET
${DEPLOY_SECRET}

Repository secret: VPS_DEPLOY_URL
${PUBLIC_DEPLOY_URL}

(Paste the secret with NO quotes. It must match ${ENV_FILE} exactly.)

Local webhook test: HTTP ${code:-failed}
${body}

If HTTP is 202, auto-deploy is ready. Re-run "Deploy to Hostinger VPS" in Actions.
If HTTP is 401, restart the service again: sudo systemctl restart ${SERVICE}
================================================================================
EOF

if [[ "$code" != "202" && "$code" != "200" ]]; then
  exit 1
fi
