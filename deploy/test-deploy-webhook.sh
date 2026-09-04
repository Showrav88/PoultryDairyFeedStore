#!/usr/bin/env bash
# Test webhook deploy from the VPS itself (run as root after setup).
#   sudo bash /var/www/NEWPROJECT/deploy/test-deploy-webhook.sh
set -Eeuo pipefail

APP_DIR="/var/www/NEWPROJECT"
ENV_FILE="${APP_DIR}/.env"
URL="http://127.0.0.1:5001/api/deploy"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  exit 1
fi

SECRET="$(grep '^DEPLOY_WEBHOOK_SECRET=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
if [[ -z "$SECRET" ]]; then
  echo "DEPLOY_WEBHOOK_SECRET is empty in $ENV_FILE"
  echo "Run: sudo bash ${APP_DIR}/deploy/setup-github-actions-deploy.sh"
  exit 1
fi

echo "Testing POST $URL"
response=$(curl -sS -w "\nHTTP_CODE:%{http_code}" -X POST "$URL" \
  -H "Authorization: Bearer ${SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"sha":"local-test"}')

body="${response%HTTP_CODE:*}"
code="${response##*HTTP_CODE:}"

if [[ "$code" == "401" ]]; then
  echo ""
  echo "401 = secret mismatch OR old app code without /api/deploy."
  echo "1) git pull origin main && sudo /usr/local/sbin/deploy-newproject"
  echo "2) Copy this secret to GitHub DEPLOY_WEBHOOK_SECRET (no quotes):"
  echo "$SECRET"
elif [[ "$code" == "202" ]]; then
  echo ""
  echo "202 = deploy started in background. Watch:"
  echo "  sudo tail -f /var/log/newproject-deploy.log"
fi
