#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/var/www/NEWPROJECT"
BRANCH="${DEPLOY_BRANCH:-main}"
LOCK_FILE="/var/lock/newproject-deploy.lock"
LOG_FILE="/var/log/newproject-deploy.log"

exec > >(tee -a "$LOG_FILE") 2>&1

on_error() {
  echo "Deploy failed at line $1 (exit $2)"
  exit "$2"
}
trap 'on_error $LINENO $?' ERR

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another newproject deployment is already running."
  exit 1
fi

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "Repository is missing at $APP_DIR"
  exit 1
fi

echo "=== Deploy started $(date -Is) ==="

sudo -u newproject git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true

echo "Deploying newproject from origin/$BRANCH..."

sudo -u newproject -H git -C "$APP_DIR" fetch origin "$BRANCH"
sudo -u newproject -H git -C "$APP_DIR" checkout "$BRANCH"
sudo -u newproject -H git -C "$APP_DIR" pull --ff-only origin "$BRANCH"

sudo -u newproject -H bash -lc "
  set -Eeuo pipefail
  cd '$APP_DIR'
  if [[ -f .env ]]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
  fi
  npm ci
  npm run build
  npx prisma migrate deploy
"

# Restart outside the Node service cgroup so the webhook request can finish.
systemd-run --wait --collect --unit=newproject-deploy-restart \
  systemctl restart newproject-api.service

for attempt in {1..30}; do
  if curl --fail --silent --show-error http://127.0.0.1:5001/api/health >/dev/null; then
    SHA="$(git -C "$APP_DIR" rev-parse --short HEAD)"
    echo "$SHA" > "$APP_DIR/.deploy-sha"
    echo "Deployment healthy: $SHA"
    exit 0
  fi
  sleep 2
done

echo "Health check failed. Recent service logs:"
journalctl -u newproject-api.service -n 50 --no-pager
exit 1
