#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/var/www/NEWPROJECT"
BRANCH="${DEPLOY_BRANCH:-main}"
LOCK_FILE="/var/lock/newproject-deploy.lock"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another newproject deployment is already running."
  exit 1
fi

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "Repository is missing at $APP_DIR"
  exit 1
fi

echo "Deploying newproject from origin/$BRANCH..."

sudo -u newproject -H git -C "$APP_DIR" fetch origin "$BRANCH"
sudo -u newproject -H git -C "$APP_DIR" checkout "$BRANCH"
sudo -u newproject -H git -C "$APP_DIR" pull --ff-only origin "$BRANCH"

sudo -u newproject -H bash -lc "
  cd '$APP_DIR'
  npm ci
  npm test
  npm run build
  npx prisma migrate deploy
"

systemctl restart newproject-api.service

for attempt in {1..20}; do
  if curl --fail --silent --show-error http://127.0.0.1:5001/api/health >/dev/null; then
    echo "Deployment healthy: $(git -C "$APP_DIR" rev-parse --short HEAD)"
    exit 0
  fi
  sleep 2
done

echo "Health check failed. Recent service logs:"
journalctl -u newproject-api.service -n 50 --no-pager
exit 1
