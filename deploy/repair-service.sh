#!/usr/bin/env bash
# Fix app service when it crash-loops after deploy (exit code 1).
# Run on VPS as root:
#   sudo bash /var/www/NEWPROJECT/deploy/repair-service.sh
set -Eeuo pipefail

APP_DIR="/var/www/NEWPROJECT"
APP_USER="newproject"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash $0"
  exit 1
fi

echo "=== Repair newproject-api.service ==="

# Clear deploy locks
rm -f /var/lock/newproject-deploy.pid /var/lock/newproject-deploy.lock "${APP_DIR}/.deploy.lock"

echo "1. Fix file ownership ..."
chown -R "${APP_USER}:${APP_USER}" "$APP_DIR"

echo "2. Show last service errors ..."
journalctl -u newproject-api.service -n 30 --no-pager || true

echo "3. Rebuild as ${APP_USER} ..."
sudo -u "${APP_USER}" -H bash -lc "
  set -Eeuo pipefail
  cd '$APP_DIR'
  if [[ -f .env ]]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
  fi
  if [[ -z \"\${DATABASE_URL:-}\" ]]; then
    echo 'ERROR: DATABASE_URL missing in .env'
    exit 1
  fi
  npm ci --include=dev
  npm run build
  npx prisma migrate deploy
"

echo "4. Restart service ..."
systemctl restart newproject-api.service
sleep 6

echo "5. Status ..."
systemctl status newproject-api.service --no-pager -l || true

echo "6. Health ..."
if curl --fail --silent http://127.0.0.1:5001/api/health; then
  SHA="$(sudo -u "${APP_USER}" git -C "$APP_DIR" rev-parse --short HEAD)"
  printf '{"state":"ready","sha":"%s","message":"Repaired via repair-service.sh","updatedAt":"%s"}\n' \
    "$SHA" "$(date -Is)" > "${APP_DIR}/.deploy-status"
  chown "${APP_USER}:${APP_USER}" "${APP_DIR}/.deploy-status"
  rm -f "${APP_DIR}/.deploy.lock"
  echo ""
  echo "Repair OK — app is healthy."
else
  echo ""
  echo "Still failing. Full logs:"
  journalctl -u newproject-api.service -n 80 --no-pager
  exit 1
fi
